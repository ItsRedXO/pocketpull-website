import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';
import { createDatabase } from './db';

export async function requireAuth(c: Context): Promise<string> {
  const blink = getBlinkServer(c.env as any);
  const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
  if (!auth.valid || !auth.userId) throw new Error('UNAUTHORIZED');
  try {
    const user = await blink.db.users.get(auth.userId) as any;
    if (user && Number(user.isDeleted || user.is_deleted || 0) > 0) throw new Error('ACCOUNT_DEACTIVATED');
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') throw err;
    throw new Error(`DATABASE_UNAVAILABLE: ${err.message || 'PostgreSQL request failed'}`);
  }
  return auth.userId;
}

/**
 * Compatibility facade while PocketPull moves its application data to PostgreSQL.
 * Blink remains only for the existing auth issuer and email notification service;
 * no application database operation is delegated to Blink.
 */
export function getBlinkServer(env: Record<string, string>) {
  const blink = createClient({ projectId: env.BLINK_PROJECT_ID, secretKey: env.BLINK_SECRET_KEY });
  return {
    auth: blink.auth,
    notifications: blink.notifications,
    db: createDatabase(env),
    realtime: { async publish() { return undefined; } },
  };
}

export function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export const BOT_REWARD_RECIPIENT_ID = 'usr_ro8OEE9fdBs2';

export function getRewardUserId(originalUserId: string, isBot: boolean): string {
  if (!originalUserId) return BOT_REWARD_RECIPIENT_ID;
  if (isBot || (typeof originalUserId === 'string' && originalUserId.startsWith('ai_'))) return BOT_REWARD_RECIPIENT_ID;
  return originalUserId;
}

export function assertPositive(val: number, name = 'amount'): void {
  if (!Number.isFinite(val) || val <= 0) throw new Error(`Invalid ${name}: must be a positive number`);
}
