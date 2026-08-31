import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';

/** Verify the user JWT from Authorization header. Returns userId or throws. */
export async function requireAuth(c: Context): Promise<string> {
  const blink = getBlinkServer(c.env as any);
  const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
  if (!auth.valid || !auth.userId) {
    throw new Error('UNAUTHORIZED');
  }
  
  // Check if user is deleted/deactivated
  try {
    const user = await blink.db.users.get(auth.userId) as any;
    if (user && Number(user.isDeleted || user.is_deleted || 0) > 0) {
      throw new Error('ACCOUNT_DEACTIVATED');
    }
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') throw err;
    // ignore DB errors here to avoid blocking auth if DB is slow, 
    // routes will check again when they fetch user data
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