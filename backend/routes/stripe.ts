import { Hono } from 'hono';
import { Stripe } from 'stripe';
import { requireAuth, getBlinkServer } from '../lib/auth';
import { getUserProfile } from '../db/repositories/users';
import { getDb } from '../db/client';
import { writeLog } from './logs';
import { processFirstDepositBonus, processReferralReward } from '../lib/payments';
import { processWalletTransaction } from '../lib/wallet';

const app = new Hono();
const getStripe = (env: any): Stripe => {
  const key = env.STRIPE_SECRET_KEY || env.VITE_STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set in environment');
  return new Stripe(key, { apiVersion: '2023-10-16' as any });
};

app.post('/create-payment-intent', async (c) => {
  let authUserId: string;
  try { authUserId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  try {
    const body = await c.req.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) return c.json({ error: 'Minimum deposit is $5.00' }, 400);
    if (body.userId && body.userId !== authUserId) return c.json({ error: 'User mismatch' }, 403);
    const user = await getUserProfile(c.env as any, authUserId);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const username = body.username || user.username || user.displayName || 'Trainer';
    const email = body.email || user.email || '';
    const stripe = getStripe(c.env);
    let customerId: string | undefined;
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data[0]) { customerId = existing.data[0].id; await stripe.customers.update(customerId, { name: username, metadata: { userId: authUserId } }); }
      else customerId = (await stripe.customers.create({ email, name: username, metadata: { userId: authUserId } })).id;
    }
    const pi = await stripe.paymentIntents.create({ amount: Math.round(amountUsd * 100), currency: 'usd', automatic_payment_methods: { enabled: true }, ...(customerId ? { customer: customerId } : {}), metadata: { userId: authUserId, username, email, amountUsd: amountUsd.toFixed(2) }, description: `PocketPull deposit - ${username}` });
    return c.json({ clientSecret: pi.client_secret, id: pi.id });
  } catch (err: any) { console.error('[Stripe] create-payment-intent:', err?.message || err); return c.json({ error: err?.message || 'Internal Server Error' }, 500); }
});

app.post('/webhook/stripe', async (c) => {
  const stripe = getStripe(c.env);
  const signature = c.req.header('stripe-signature');
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return c.text('Missing signature or secret', 400);
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(await c.req.text(), signature, secret); }
  catch (err: any) { return c.text(`Webhook Error: ${err?.message || 'invalid signature'}`, 400); }
  if (event.type === 'payment_intent.succeeded') {
    try { await processSuccessfulPayment(c.env as any, event.data.object as Stripe.PaymentIntent); }
    catch (err: any) { console.error('[Stripe Webhook] processing failed:', err?.message || err); return c.json({ error: err?.message || 'Processing failed' }, 500); }
  }
  return c.json({ received: true });
});

app.post('/verify-deposit', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  try {
    const { paymentIntentId } = await c.req.json();
    if (!paymentIntentId) return c.json({ error: 'paymentIntentId required' }, 400);
    const pi = await getStripe(c.env).paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') return c.json({ error: `Payment intent status: ${pi.status}` }, 400);
    if (pi.metadata?.userId !== userId) return c.json({ error: 'Payment intent does not belong to authenticated user' }, 403);
    return c.json({ success: true, ...(await processSuccessfulPayment(c.env as any, pi)) });
  } catch (err: any) { return c.json({ error: err?.message || 'Verification failed' }, 500); }
});

async function processSuccessfulPayment(env: any, paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata || {};
  const userId = meta.userId;
  const depositAmt = Number(meta.amountUsd || (paymentIntent.amount / 100));
  if (!userId || !Number.isFinite(depositAmt) || depositAmt <= 0) throw new Error('Missing critical payment metadata');
  const user = await getUserProfile(env, userId);
  if (!user) throw new Error('User not found');
  const blink = getBlinkServer(env);
  const wallet = await processWalletTransaction(blink, { userId, type: 'deposit', amount: depositAmt, sourceId: paymentIntent.id, metadata: { provider: 'stripe', paymentIntentId: paymentIntent.id } });
  if (!wallet.success) throw new Error(wallet.error || 'Failed to credit balance');
  const txnId = `txn_stripe_${paymentIntent.id}`;
  await getDb(env).query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,'deposit',$3,$4,NOW()) ON CONFLICT (id) DO NOTHING`, [txnId, userId, depositAmt, `Stripe deposit — ${depositAmt.toFixed(2)} · ${meta.username || user.username || 'Trainer'}`]);
  await writeLog(blink, { type: 'deposit', userId, username: meta.username || user.username || 'Trainer', action: 'Stripe Deposit Confirmed', details: { amount: depositAmt, paymentIntentId: paymentIntent.id, paymentMethod: 'Stripe', status: 'completed' }, valueIn: depositAmt, valueOut: 0, result: 'success' });
  if (!user.firstDepositBonusPaid) await processFirstDepositBonus(blink, userId, depositAmt);
  if (depositAmt >= 5 && user.referredById && !user.referralRewardPaid) await processReferralReward(blink, userId, user.referredById, depositAmt);
  return { status: 'success', newBalance: wallet.balanceAfter };
}

export default app;
