import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';
import { getUserAuthState } from '../db/repositories/users';

/**
 * Verify the existing Blink JWT so current logins/sessions keep working during
 * the migration, then validate the corresponding account state in PostgreSQL.
 */
export async function requireAuth(c: Context): Promise<string> {
  const env = c.env as Record<string, string>;
  const blink = getBlinkServer(env);
  const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
  if (!auth.valid || !auth.userId) {
    throw new Error('UNAUTHORIZED');
  }

  // Business account state now comes from PostgreSQL. Blink remains auth-only
  // in this migration phase.
  const user = await getUserAuthState(env, auth.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  if (user.isDeleted) {
    throw new Error('ACCOUNT_DEACTIVATED');
  }
  if (user.isBanned) {
    throw new Error('ACCOUNT_BANNED');
  }

  return auth.userId;
}

export function getBlinkServer(env: Record<string, string>) {
  return createClient({
    projectId: env.BLINK_PROJECT_ID,
    secretKey: env.BLINK_SECRET_KEY,
  });
}

/** Generate a short unique ID */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Generate a unique referral code */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const BOT_REWARD_RECIPIENT_ID = 'usr_ro8OEE9fdBs2';

/** Get the correct userId for rewards. Routes bot winnings to the collector account. */
export function getRewardUserId(originalUserId: string, isBot: boolean): string {
  if (!originalUserId) return BOT_REWARD_RECIPIENT_ID;
  if (isBot || (typeof originalUserId === 'string' && originalUserId.startsWith('ai_'))) {
    return BOT_REWARD_RECIPIENT_ID;
  }
  return originalUserId;
}

/** Validate amount is a positive number */
export function assertPositive(val: number, name = 'amount'): void {
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error(`Invalid ${name}: must be a positive number`);
  }
}
