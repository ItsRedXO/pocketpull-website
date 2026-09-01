import { Hono } from 'hono';
import { SignJWT, importPKCS8 } from 'jose';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { getUserProfile } from '../db/repositories/users';
import { getDb } from '../db/client';
import { processWalletTransaction } from '../lib/wallet';
import { processFirstDepositBonus, processReferralReward } from '../lib/payments';
import { writeLog } from './logs';

const app = new Hono();

async function generateCDPToken(keyId: string, privateKey: string) {
  let key = privateKey.split('\\n').join('\n').trim();
  if (!key.startsWith('-----BEGIN')) key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  const signingKey = await importPKCS8(key.replace(/BEGIN EC PRIVATE KEY/g, 'BEGIN PRIVATE KEY').replace(/END EC PRIVATE KEY/g, 'END PRIVATE KEY'), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' }).setIssuer('cdp').setSubject(`cdp:${keyId}`).setAudience('cdp').setIssuedAt(now).setNotBefore(now - 30).setExpirationTime(now + 60).setJti(uid()).sign(signingKey);
}

app.post('/create-coinbase-charge', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  try {
    const body = await c.req.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) return c.json({ error: 'Minimum deposit is $5.00' }, 400);
    const user = await getUserProfile(c.env as any, userId);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const keyId = c.env.COINBASE_CDP_KEY_ID;
    const secret = c.env.COINBASE_CDP_KEY_SECRET;
    if (!keyId || !secret) return c.json({ error: 'Coinbase CDP keys not configured.' }, 500);
    const token = await generateCDPToken(keyId, secret);
    const response = await fetch('https://api.commerce.coinbase.com/charges', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CC-Version': '2018-03-22', 'User-Agent': 'PocketPull/1.0.0' }, body: JSON.stringify({ name: 'PocketPull Deposit', description: `Add ${amountUsd.toFixed(2)} to your PocketPull balance`, pricing_type: 'fixed_price', local_price: { amount: amountUsd.toFixed(2), currency: 'USD' }, metadata: { user_id: userId, username: user.username || user.displayName || 'Trainer', amount_usd: amountUsd.toFixed(2) }, redirect_url: 'https://pocketpulltcg.com?deposit=success', cancel_url: 'https://pocketpulltcg.com?deposit=cancelled' }) });
    const data = await response.json().catch(() => null) as any;
    if (!response.ok) return c.json({ error: data?.error?.message || data?.message || 'CDP API failed' }, response.status as any);
    const charge = data?.data;
    return c.json({ chargeId: charge?.id, hostedUrl: charge?.hosted_url, expiresAt: charge?.expires_at });
  } catch (err: any) { console.error('[Coinbase] create charge:', err?.message || err); return c.json({ error: err?.message || 'Internal Server Error' }, 500); }
});

app.get('/coinbase-charge-status', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  const chargeId = c.req.query('chargeId');
  if (!chargeId) return c.json({ error: 'chargeId required' }, 400);
  try {
    const txn = await getDb(c.env as any).query(`SELECT 1 FROM transactions WHERE id=$1 AND user_id=$2 AND type='deposit' LIMIT 1`, [`txn_coinbase_${chargeId}`, userId]);
    if (!txn.rows.length) return c.json({ confirmed: false });
    const user = await getUserProfile(c.env as any, userId);
    return c.json({ confirmed: true, newBalance: user?.balance || 0 });
  } catch (err: any) { return c.json({ error: err?.message || 'Failed to check charge status' }, 500); }
});

app.post('/webhook/coinbase', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-CC-Webhook-Signature');
  const secret = c.env.COINBASE_WEBHOOK_SECRET;
  if (!signature || !secret) return c.text('Missing signature or secret', 400);
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    if (signature !== expected) return c.text('Invalid signature', 400);
  } catch { return c.text('Signature verification error', 400); }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return c.text('Invalid JSON body', 400); }
  if (!['checkout.payment.success','charge:confirmed','charge:resolved'].includes(event?.type)) return c.json({ received: true });
  const charge = event.data?.id ? event.data : (event.data?.object || event.data || {});
  const metadata = charge.metadata || {};
  const userId = metadata.user_id || metadata.userId;
  const amount = Number(metadata.amount_usd || metadata.amountUsd);
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !charge.id) return c.json({ received: true });
  try {
    const user = await getUserProfile(c.env as any, userId);
    if (!user) return c.json({ received: true });
    const blink = getBlinkServer(c.env as any);
    const wallet = await processWalletTransaction(blink, { userId, type: 'deposit', amount, sourceId: charge.id, metadata: { provider: 'coinbase', chargeId: charge.id } });
    if (!wallet.success) throw new Error(wallet.error || 'Failed to credit balance');
    await getDb(c.env as any).query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,'deposit',$3,$4,NOW()) ON CONFLICT (id) DO NOTHING`, [`txn_coinbase_${charge.id}`, userId, amount, `Coinbase deposit — ${amount.toFixed(2)} · ${metadata.username || user.username || 'Trainer'}`]);
    await writeLog(blink, { type: 'deposit', userId, username: metadata.username || user.username || 'Trainer', action: 'Coinbase Deposit Confirmed', details: { amount, chargeId: charge.id, paymentMethod: 'Coinbase Commerce' }, valueIn: amount, valueOut: 0, result: 'success' });
    if (!user.firstDepositBonusPaid) await processFirstDepositBonus(blink, userId, amount);
    if (amount >= 5 && user.referredById && !user.referralRewardPaid) await processReferralReward(blink, userId, user.referredById, amount);
  } catch (err: any) { console.error('[Coinbase Webhook] processing failed:', err?.message || err); return c.json({ error: 'Processing failed' }, 500); }
  return c.json({ received: true });
});

export default app;
