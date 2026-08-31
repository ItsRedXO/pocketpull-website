/**
 * Stripe payment routes.
 *
 * POST /create-payment-intent  — create a Stripe PaymentIntent
 * POST /webhook/stripe          — handle Stripe webhook events
 * POST /verify-deposit          — fallback balance verification
 */
import { Hono } from 'hono';
import { Stripe } from 'stripe';
import { getBlinkServer } from '../lib/auth';
import { writeLog } from './logs';
import { processFirstDepositBonus, processReferralReward } from '../lib/payments';
import { processWalletTransaction } from '../lib/wallet';

const app = new Hono();

const getStripe = (env: any): Stripe => {
  const key = env.STRIPE_SECRET_KEY || env.VITE_STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set in environment');
  return new Stripe(key, {
    apiVersion: '2023-10-16' as any,
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /create-payment-intent
// ──────────────────────────────────────────────────────────────────────────────
app.post('/create-payment-intent', async (c) => {
  console.log('[Stripe] create-payment-intent started');
  try {
    const body = await c.req.json().catch(() => ({}));
    const { amountUsd, userId } = body;
    let { username, email } = body;

    if (!amountUsd || parseFloat(amountUsd) < 5) {
      return c.json({ error: 'Minimum deposit is $5.00' }, 400);
    }
    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    const stripe = getStripe(c.env);
    const blink = getBlinkServer(c.env as any);
    const amountCents = Math.round(parseFloat(amountUsd) * 100);

    // Look up user from DB if not passed from frontend
    if (!username || !email) {
      try {
        const userRow = await blink.db.users.get(userId) as any;
        if (userRow) {
          if (!username) username = userRow.username || userRow.displayName || 'Trainer';
          if (!email) email = userRow.email || '';
        }
      } catch (lookupErr: any) {
        console.warn('[Stripe] User lookup failed:', lookupErr.message);
      }
    }

    const safeUsername = username || 'Unknown';
    const safeEmail    = email    || '';

    // Find or create Stripe customer
    let customerId: string | undefined;
    if (safeEmail) {
      try {
        const existing = await stripe.customers.list({ email: safeEmail, limit: 1 });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
          await stripe.customers.update(customerId, {
            name: safeUsername,
            metadata: { userId, username: safeUsername, email: safeEmail },
          });
        } else {
          const customer = await stripe.customers.create({
            email: safeEmail,
            name: safeUsername,
            metadata: { userId, username: safeUsername, email: safeEmail },
          });
          customerId = customer.id;
        }
      } catch (custErr: any) {
        console.warn('[Stripe] Customer lookup/create failed:', custErr.message);
      }
    }

    const description = safeEmail
      ? `PocketPull deposit - ${safeUsername} (${safeEmail})`
      : `PocketPull deposit - ${safeUsername} [${userId}]`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      ...(customerId ? { customer: customerId } : {}),
      metadata: { userId, username: safeUsername, email: safeEmail, amountUsd: String(amountUsd) },
      description,
    });

    console.log(`[Stripe] PaymentIntent created: ${paymentIntent.id}`);
    return c.json({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
  } catch (err: any) {
    console.error('[Stripe] create-payment-intent Error:', err.message);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /webhook/stripe
// ──────────────────────────────────────────────────────────────────────────────
app.post('/webhook/stripe', async (c) => {
  console.log('[Stripe Webhook] Received request');
  const stripe = getStripe(c.env);
  const blink  = getBlinkServer(c.env as any);
  
  const signature = c.req.header('stripe-signature');
  const webhookSecret = (c.env as any).STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('[Stripe Webhook] Missing signature or secret');
    return c.text('Missing signature or secret', 400);
  }

  let event: Stripe.Event;
  try {
    const body = await c.req.text();
    // Use constructEventAsync for better compatibility with Edge environments
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
    return c.text(`Webhook Error: ${err.message}`, 400);
  }

  console.log(`[Stripe Webhook] Event verified. Type: ${event.type}`);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log(`[Stripe Webhook] Processing PI: ${paymentIntent.id}`);
    try {
      await processSuccessfulPayment(blink, paymentIntent);
    } catch (processErr: any) {
      console.error(`[Stripe Webhook] Error processing payment: ${processErr.message}`);
      return c.json({ error: processErr.message }, 500);
    }
  }

  return c.json({ received: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /verify-deposit  (fallback — call after frontend Stripe confirmation)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/verify-deposit', async (c) => {
  console.log('[Stripe] verify-deposit request received');
  const blink  = getBlinkServer(c.env as any);
  const stripe = getStripe(c.env);
  try {
    const body = await c.req.json();
    const { paymentIntentId } = body;
    
    if (!paymentIntentId) return c.json({ error: 'paymentIntentId required' }, 400);

    console.log(`[Stripe] Verifying PI: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      const result = await processSuccessfulPayment(blink, paymentIntent);
      return c.json({ success: true, ...result });
    } else {
      console.warn(`[Stripe] PI not succeeded: ${paymentIntent.status}`);
      return c.json({ error: `Payment intent status: ${paymentIntent.status}` }, 400);
    }
  } catch (err: any) {
    console.error('[Stripe] verify-deposit Error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Idempotent: credits balance for a succeeded PaymentIntent (won't double-credit). */
async function processSuccessfulPayment(blink: any, paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata || {};
  const userId = meta.userId;
  let amountUsd = meta.amountUsd;
  const metaUsername = meta.username;
  const metaEmail = meta.email;
  const piId = paymentIntent.id;

  // Fallback: If amountUsd is missing from metadata, use the PaymentIntent amount
  if (!amountUsd && paymentIntent.amount) {
    amountUsd = (paymentIntent.amount / 100).toFixed(2);
    console.log(`[Stripe] amountUsd missing in metadata, falling back to PI amount: ${amountUsd}`);
  }

  console.log(`[Stripe] Processing payment for PI: ${piId}, User: ${userId}, Amount: ${amountUsd}`);

  if (!userId || !amountUsd) {
    console.error(`[Stripe] Missing critical metadata for PI ${piId}. Metadata: ${JSON.stringify(meta)}`);
    return { error: 'Missing critical metadata (userId or amount)' };
  }

  const depositAmt = parseFloat(amountUsd);
  const txnId = `txn_stripe_${piId}`;

  try {
    const existingTxn = await blink.db.transactions.get(txnId);
    if (existingTxn) {
      console.log(`[Stripe] PI ${piId} already processed. Skipping.`);
      return { status: 'already_processed' };
    }
  } catch {}

  try {
    const user = await blink.db.users.get(userId);
    if (!user) {
      console.error(`[Stripe] User ${userId} not found`);
      return { error: 'User not found' };
    }

    const u2 = user as any;
    const resolvedUsername = metaUsername || u2.username || u2.displayName || 'Trainer';
    const resolvedEmail    = metaEmail    || u2.email    || '';

    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'deposit',
      amount: depositAmt,
      sourceId: piId,
    });

    if (!walletResult.success) {
      console.error(`[Stripe] Wallet transaction failed for PI ${piId}: ${walletResult.error}`);
      return { error: walletResult.error || 'Failed to credit balance' };
    }

    const newBal = walletResult.balanceAfter;
    console.log(`[Stripe] Balance updated for user ${userId}: ${walletResult.balanceBefore.toFixed(2)} -> ${newBal.toFixed(2)}`);

    const txnDescription = resolvedEmail
      ? `Stripe deposit — ${depositAmt.toFixed(2)} · ${resolvedUsername} (${resolvedEmail})`
      : `Stripe deposit — ${depositAmt.toFixed(2)} · ${resolvedUsername}`;

    await blink.db.transactions.create({
      id: txnId,
      userId,
      type: 'deposit',
      amount: depositAmt,
      description: txnDescription,
      createdAt: new Date().toISOString(),
    } as any);

    try {
      await writeLog(blink, {
        type: 'deposit',
        userId,
        username: resolvedUsername,
        action: 'Stripe Deposit Confirmed',
        details: {
          amount: depositAmt,
          paymentIntentId: piId,
          paymentMethod: 'Stripe',
          status: 'completed',
          email: resolvedEmail,
        },
        valueIn: depositAmt,
        valueOut: 0,
        result: 'success',
      });
    } catch (logErr) {
      console.warn('[Stripe] Activity log failed', logErr);
    }

    // First deposit bonus — 100% match up to $100, once per account
    if (!u2.firstDepositBonusPaid && Number(u2.firstDepositBonusPaid) === 0) {
      await processFirstDepositBonus(blink, userId, depositAmt);
    }

    // Referral reward — $10 to BOTH referrer and referred user on first deposit ≥ $5
    if (depositAmt >= 5 && u2.referredById && !u2.referralRewardPaid) {
      await processReferralReward(blink, userId, u2.referredById, depositAmt);
    }

    return { status: 'success', newBalance: newBal };
  } catch (err: any) {
    console.error(`[Stripe] processSuccessfulPayment Critical Error:`, err.message);
    throw err;
  }
}

export default app;
