/**
 * Coinbase Commerce routes.
 *
 * POST /create-coinbase-charge    — create a hosted checkout charge
 * GET  /coinbase-charge-status    — poll for payment confirmation
 * POST /webhook/coinbase          — handle Coinbase webhook events
 */
import { Hono } from 'hono';
import { getBlinkServer, uid } from '../lib/auth';
import { writeLog } from './logs';
import { processFirstDepositBonus, processReferralReward } from '../lib/payments';
import { processWalletTransaction } from '../lib/wallet';
import { SignJWT, importPKCS8, importJWK } from 'jose';

const app = new Hono();

/** Generate a JWT for Coinbase Developer Platform (CDP) authentication */
async function generateCDPToken(keyId: string, privateKey: string) {
  const algorithm = 'ES256';
  
  if (!privateKey) throw new Error('Private key is empty');

  // Handle literal "\n" strings if they were pasted that way
  let cleanKey = privateKey.split('\\n').join('\n').trim();
  
  let formattedKey = cleanKey;

  // If it's a SEC1 key (EC PRIVATE KEY), jose importPKCS8 will fail.
  // We strictly enforce PKCS8 or try to convert.
  if (formattedKey.includes('BEGIN EC PRIVATE KEY')) {
    // Attempt conversion by swapping headers (only works if content is compatible)
    formattedKey = formattedKey
      .replace(/BEGIN EC PRIVATE KEY/g, 'BEGIN PRIVATE KEY')
      .replace(/END EC PRIVATE KEY/g, 'END PRIVATE KEY');
  } else if (!formattedKey.startsWith('-----BEGIN')) {
    // If it's just the base64 part, wrap it in PKCS8
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  try {
    const pkcs8Key = await importPKCS8(formattedKey, algorithm);

    // Modern CDP JWT claims
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: algorithm, kid: keyId, typ: 'JWT' })
      .setIssuer('cdp')
      .setSubject(`cdp:${keyId}`)
      .setAudience('cdp')
      .setIssuedAt(now)
      .setNotBefore(now - 30)
      .setExpirationTime(now + 60)
      .setJti(uid())
      .sign(pkcs8Key);

    return token;
  } catch (err: any) {
    throw new Error(`JWT sign failed: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /create-coinbase-charge
// ──────────────────────────────────────────────────────────────────────────────
app.post('/create-coinbase-charge', async (c) => {
  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json().catch(() => ({}));
    const { amountUsd, userId, username: bodyUsername } = body;

    if (!amountUsd || parseFloat(amountUsd) < 5) {
      return c.json({ error: 'Minimum deposit is $5.00' }, 400);
    }
    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    const cdpKeyId = (c.env as any).COINBASE_CDP_KEY_ID;
    const cdpSecret = (c.env as any).COINBASE_CDP_KEY_SECRET;

    if (!cdpKeyId || !cdpSecret) {
      return c.json({ error: 'Coinbase CDP keys not configured.' }, 500);
    }

    let username = bodyUsername;
    if (!username) {
      try {
        const u = await blink.db.users.get(userId) as any;
        username = u?.username || u?.displayName || 'Trainer';
      } catch {}
    }

    const amt = parseFloat(amountUsd);

    const token = await generateCDPToken(cdpKeyId, cdpSecret);

    const chargeRes = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-CC-Version': '2018-03-22',
        'User-Agent': 'PocketPull/1.0.0',
      },
      body: JSON.stringify({
        name: 'PocketPull Deposit',
        description: `Add ${amt.toFixed(2)} to your PocketPull balance`,
        pricing_type: 'fixed_price',
        local_price: { amount: amt.toFixed(2), currency: 'USD' },
        metadata: { user_id: userId, username, amount_usd: String(amountUsd) },
        redirect_url: 'https://pocketpulltcg.com?deposit=success',
        cancel_url: 'https://pocketpulltcg.com?deposit=cancelled',
      }),
    });

    const rawText = await chargeRes.text();
    console.log(`[CDP] API Status: ${chargeRes.status}, Body: ${rawText.slice(0, 500)}`);
    
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return c.json({ 
        error: 'CDP API returned non-JSON response.', 
        status: chargeRes.status,
        bodyPreview: rawText.slice(0, 200)
      }, 500);
    }

    if (!chargeRes.ok) {
      return c.json({ error: data?.error?.message || data?.message || 'CDP API failed' }, chargeRes.status as any);
    }

    const charge = data.data;
    return c.json({ 
      chargeId: charge.id, 
      hostedUrl: charge.hosted_url, 
      expiresAt: charge.expires_at 
    });

  } catch (err: any) {
    console.error('[Coinbase/CDP] Error:', err.message);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /coinbase-charge-status
// ──────────────────────────────────────────────────────────────────────────────
app.get('/coinbase-charge-status', async (c) => {
  const blink    = getBlinkServer(c.env as any);
  const chargeId = c.req.query('chargeId');
  const userId   = c.req.query('userId');

  if (!chargeId || !userId) return c.json({ error: 'chargeId and userId required' }, 400);

  try {
    const txnId = `txn_coinbase_${chargeId}`;
    const txn   = await blink.db.transactions.get(txnId);
    if (txn) {
      const user = await blink.db.users.get(userId) as any;
      return c.json({ confirmed: true, newBalance: Number(user?.balance || 0) });
    }
    return c.json({ confirmed: false });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /webhook/coinbase
// ──────────────────────────────────────────────────────────────────────────────
app.post('/webhook/coinbase', async (c) => {
  const blink = getBlinkServer(c.env as any);
  console.log('[Coinbase Webhook] Received event');

  const rawBody   = await c.req.text();
  const sigHeader = c.req.header('X-CC-Webhook-Signature');
  const secret    = (c.env as any).COINBASE_WEBHOOK_SECRET;

  if (!sigHeader || !secret) {
    console.error('[Coinbase Webhook] Missing signature or secret');
    return c.text('Missing signature or secret', 400);
  }

  // Verify HMAC-SHA256 via Web Crypto API (CF Workers compatible)
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (sigHeader !== expected) {
      console.error('[Coinbase Webhook] Invalid signature');
      return c.text('Invalid signature', 400);
    }
  } catch (sigErr: any) {
    console.error('[Coinbase Webhook] Signature check error:', sigErr.message);
    return c.text('Signature verification error', 400);
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return c.text('Invalid JSON body', 400); }

  const eventType: string = event.type || '';
  console.log(`[Coinbase Webhook] Event: ${eventType}`);

  // Handle both modern Checkouts API events and legacy Commerce events
  const isSuccessfulPayment = 
    eventType === 'checkout.payment.success' || 
    eventType === 'charge:confirmed' || 
    eventType === 'charge:resolved';

  if (isSuccessfulPayment) {
    const data = event.data || {};
    // Modern API uses 'data' root, legacy might use 'data' or nested 'charge'
    const charge = data.id ? data : (data.object || data);
    
    const metadata = charge.metadata || {};
    const userId   = metadata.user_id || metadata.userId;
    const username = metadata.username || 'Trainer';
    const amountUsd = metadata.amount_usd || metadata.amountUsd;

    if (!userId || !amountUsd) {
      console.error('[Coinbase Webhook] Missing metadata on event', charge.id);
      return c.json({ received: true });
    }

    try {
      await processCoinbaseDeposit(blink, charge.id, userId, username, parseFloat(amountUsd));
    } catch (err: any) {
      console.error('[Coinbase Webhook] processCoinbaseDeposit failed:', err.message);
    }
  }

  return c.json({ received: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Idempotent: credit user balance for a confirmed Coinbase charge. */
async function processCoinbaseDeposit(
  blink: any,
  chargeId: string,
  userId: string,
  username: string,
  depositAmt: number,
) {
  const txnId = `txn_coinbase_${chargeId}`;

  // Idempotency check
  try {
    const existing = await blink.db.transactions.get(txnId);
    if (existing) {
      console.log(`[Coinbase] Charge ${chargeId} already processed. Skipping.`);
      return { status: 'already_processed' };
    }
  } catch {}

  console.log(`[Coinbase] Crediting $${depositAmt} to user ${userId} for charge ${chargeId}`);

  const user = await blink.db.users.get(userId);
  if (!user) {
    console.error(`[Coinbase] User ${userId} not found`);
    return { error: 'User not found' };
  }

  const u = user as any;

  const walletResult = await processWalletTransaction(blink, {
    userId,
    type: 'deposit',
    amount: depositAmt,
    sourceId: chargeId,
  });

  if (!walletResult.success) {
    console.error(`[Coinbase] Wallet transaction failed for charge ${chargeId}: ${walletResult.error}`);
    return { error: walletResult.error || 'Failed to credit balance' };
  }

  const newBal = walletResult.balanceAfter;

  await blink.db.transactions.create({
    id: txnId,
    userId,
    type: 'deposit',
    amount: depositAmt,
    description: `Coinbase deposit — ${depositAmt.toFixed(2)} · ${username}`,
    createdAt: new Date().toISOString(),
  } as any);

  console.log(`[Coinbase] Credited ${username} (${userId}). New balance: ${newBal}`);

  try {
    await writeLog(blink, {
      type: 'deposit',
      userId,
      username,
      action: 'Coinbase Deposit Confirmed',
      details: { amount: depositAmt, chargeId, paymentMethod: 'Coinbase Commerce', status: 'completed' },
      valueIn: depositAmt,
      valueOut: 0,
      result: 'success',
    });
  } catch (logErr) {
    console.warn('[Coinbase] Failed to write activity log', logErr);
  }

  // First deposit bonus — 100% match up to $100, once per account
  if (!u.firstDepositBonusPaid && Number(u.firstDepositBonusPaid) === 0) {
    await processFirstDepositBonus(blink, userId, depositAmt);
  }

  // Referral reward — $10 to BOTH referrer and referred user on first deposit ≥ $5
  if (depositAmt >= 5 && u.referredById && !u.referralRewardPaid) {
    await processReferralReward(blink, userId, u.referredById, depositAmt);
  }

  return { status: 'success', newBalance: newBal };
}

export default app;