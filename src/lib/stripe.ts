import { loadStripe } from '@stripe/stripe-js';
import { blink } from './blink';

// Stripe publishable key — safe to expose in client
const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
  || 'pk_live_51Tba52A8wAVcexxVHeljjbYV0F5skma3pncZQ7rzfQ7KDSPJYxoH1aye9aSkWHY7Igmw54IUhiJX1Bvuzqgz5Sqn00VopciKn1';

const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

export const stripePromise = loadStripe(PK || '');

/**
 * Creates a Stripe PaymentIntent by calling our SECURE backend.
 * Returns the client_secret needed to confirm payment client-side.
 */
export async function createPaymentIntent(
  amountUsd: number,
  userId: string,
  username?: string,
  email?: string,
): Promise<string> {
  if (amountUsd < 5) throw new Error('Minimum deposit is $5.00');

  const response = await fetch(`${BACKEND_BASE}/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountUsd, userId, username: username || '', email: email || '' }),
  });

  const data = await response.json() as any;

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to create payment session');
  }

  return data.clientSecret;
}

/**
 * @deprecated Backend webhook handles verification and balance updates now.
 * Retrieving PaymentIntent client-side is no longer recommended for balance updates.
 */
export async function getPaymentIntent(clientSecret: string): Promise<{ status: string; id: string }> {
  // We no longer expose the secret key to the client, so we can't fetch this directly.
  // This is replaced by the backend webhook flow.
  console.warn('getPaymentIntent client-side is deprecated. Use backend webhooks.');
  return { status: 'check_webhook', id: 'pi_webhook_verified' };
}
