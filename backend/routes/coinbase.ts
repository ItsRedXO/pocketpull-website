import { Hono } from 'hono';
import { uid } from '../lib/auth';
import { query, transaction } from '../lib/postgres';
import { writeLog } from './logs';
import { processFirstDepositBonus, processReferralReward } from '../lib/payments';
import { processWalletTransactionInClient } from '../repositories/wallet';
import { SignJWT, importPKCS8 } from 'jose';

const app = new Hono();

async function generateCDPToken(keyId: string, privateKey: string) {
  let clean = privateKey.split('\\n').join('\n').trim();
  if (clean.includes('BEGIN EC PRIVATE KEY')) clean = clean.replace(/BEGIN EC PRIVATE KEY/g, 'BEGIN PRIVATE KEY').replace(/END EC PRIVATE KEY/g, 'END PRIVATE KEY');
  else if (!clean.startsWith('-----BEGIN')) clean = `-----BEGIN PRIVATE KEY-----\n${clean}\n-----END PRIVATE KEY-----`;
  try {
    const key = await importPKCS8(clean, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' }).setIssuer('cdp').setSubject(`cdp:${keyId}`).setAudience('cdp').setIssuedAt(now).setNotBefore(now - 30).setExpirationTime(now + 60).setJti(uid()).sign(key);
  } catch (e: any) {
    throw new Error(`JWT sign failed: ${e.message}`);
  }
}

app.post('/create-coinbase-charge', async c => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { amountUsd, userId, username: bodyUsername } = body;
    if (!amountUsd || parseFloat(amountUsd) < 5) return c.json({ error: 'Minimum deposit is $5.00' }, 400);
    if (!userId) return c.json({ error: 'User ID is required' }, 400);
    const keyId = (c.env as any).COINBASE_CDP_KEY_ID;
    const secret = (c.env as any).COINBASE_CDP_KEY_SECRET;
    if (!keyId || !secret) return c.json({ error: 'Coinbase CDP keys not configured.' }, 500);
    const userRows = await query<any>('SELECT username, display_name FROM users WHERE id=$1 LIMIT 1', [userId]);
    const username = bodyUsername || userRows[0]?.username || userRows[0]?.display_name || 'Trainer';
    const amt = parseFloat(amountUsd);
    const token = await generateCDPToken(keyId, secret);
    const res = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CC-Version': '2018-03-22', 'User-Agent': 'PocketPull/1.0.0' },
      body: JSON.stringify({ name: 'PocketPull Deposit', description: `Add ${amt.toFixed(2)} to your PocketPull balance`, pricing_type: 'fixed_price', local_price: { amount: amt.toFixed(2), currency: 'USD' }, metadata: { user_id: userId, username, amount_usd: String(amountUsd) }, redirect_url: 'https://pocketpulltcg.com?deposit=success', cancel_url: 'https://pocketpulltcg.com?deposit=cancelled' })
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return c.json({ error: 'CDP API returned non-JSON response.', status: res.status }, 500); }
    if (!res.ok) return c.json({ error: data?.error?.message || data?.message || 'Coinbase API failed' }, res.status as any);
    return c.json({ chargeId: data.data.id, hostedUrl: data.data.hosted_url, expiresAt: data.data.expires_at });
  } catch (e: any) {
    return c.json({ error: e.message || 'Internal Server Error' }, 500);
  }
});

app.get('/coinbase-charge-status', async c => {
  const chargeId = c.req.query('chargeId');
  const userId = c.req.query('userId');
  if (!chargeId || !userId) return c.json({ error: 'chargeId and userId required' }, 400);
  try {
    const txn = await query('SELECT 1 FROM transactions WHERE id=$1 AND user_id=$2 LIMIT 1', [`txn_coinbase_${chargeId}`, userId]);
    if (txn.length) {
      const user = await query('SELECT balance FROM users WHERE id=$1', [userId]);
      return c.json({ confirmed: true, newBalance: Number(user[0]?.balance || 0) });
    }
    return c.json({ confirmed: false });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/webhook/coinbase', async c => {
  const raw = await c.req.text();
  const sig = c.req.header('X-CC-Webhook-Signature');
  const secret = (c.env as any).COINBASE_WEBHOOK_SECRET;
  if (!sig || !secret) return c.text('Missing signature or secret', 400);
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
    const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (sig !== expected) return c.text('Invalid signature', 400);
  } catch { return c.text('Signature verification error', 400); }
  let event: any;
  try { event = JSON.parse(raw); } catch { return c.text('Invalid JSON body', 400); }
  const type = event.type || '';
  if (type === 'checkout.payment.success' || type === 'charge:confirmed' || type === 'charge:resolved') {
    const data = event.data || {};
    const charge = data.id ? data : (data.object || data);
    const metadata = charge.metadata || {};
    const userId = metadata.user_id || metadata.userId;
    const username = metadata.username || 'Trainer';
    const amountUsd = metadata.amount_usd || metadata.amountUsd;
    if (userId && amountUsd) {
      try { await processCoinbaseDeposit(charge.id, userId, username, parseFloat(amountUsd)); }
      catch (e: any) { console.error('[Coinbase]', e.message); return c.json({ error: e.message }, 500); }
    }
  }
  return c.json({ received: true });
});

async function processCoinbaseDeposit(chargeId: string, userId: string, username: string, depositAmt: number) {
  if (!Number.isFinite(depositAmt) || depositAmt < 5) return { error: 'Invalid deposit amount' };
  const result = await transaction(async client => {
    const ur = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!ur.rowCount) return { error: 'User not found' };
    const user: any = ur.rows[0];
    const txnId = `txn_coinbase_${chargeId}`;
    if ((await client.query('SELECT 1 FROM transactions WHERE id=$1', [txnId])).rowCount) return { status: 'already_processed', newBalance: Number(user.balance || 0), user, alreadyProcessed: true };
    const wallet = await processWalletTransactionInClient(client, { userId, type: 'deposit', amount: depositAmt, sourceId: chargeId, metadata: { chargeId } });
    if (!wallet.success) throw new Error(wallet.error || 'Failed to credit balance');
    await client.query("INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,'deposit',$3,$4,$5,now())", [txnId, userId, depositAmt, `Coinbase deposit — ${depositAmt.toFixed(2)} · ${username}`, chargeId]);
    return { status: 'success', newBalance: wallet.balanceAfter, user, alreadyProcessed: false };
  });
  const u: any = result.user;
  if (!result.alreadyProcessed) {
    try { await writeLog(null, { type: 'deposit', userId, username, action: 'Coinbase Deposit Confirmed', details: { amount: depositAmt, chargeId, paymentMethod: 'Coinbase Commerce', status: 'completed' }, valueIn: depositAmt, valueOut: 0, result: 'success' }); }
    catch { }
  }
  if (Number(u.first_deposit_bonus_paid || 0) === 0) await processFirstDepositBonus(null, userId, depositAmt);
  if (depositAmt >= 5 && u.referred_by_id && !Number(u.referral_reward_paid || 0)) await processReferralReward(null, userId, u.referred_by_id, depositAmt);
  return { status: 'success', newBalance: result.newBalance };
}

export default app;
