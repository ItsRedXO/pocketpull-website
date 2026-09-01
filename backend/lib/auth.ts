import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';
import { getUserAuthState } from '../db/repositories/users';

export async function requireAuth(c: Context): Promise<string> {
  const env = c.env as Record<string, string>;
  const blink = getBlinkServer(env);
  const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
  if (!auth.valid || !auth.userId) throw new Error('UNAUTHORIZED');
  const user = await getUserAuthState(env, auth.userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isDeleted) throw new Error('ACCOUNT_DEACTIVATED');
  if (user.isBanned) throw new Error('ACCOUNT_BANNED');
  return auth.userId;
}

export function getBlinkServer(env: Record<string, string>) {
  const client = createClient({ projectId: env.BLINK_PROJECT_ID, secretKey: env.BLINK_SECRET_KEY });
  (client as any).__pocketpullEnv = env;
  return client;
}

export function uid(): string { return `${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`; }

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const BOT_REWARD_RECIPIENT_ID = 'usr_ro8OEE9fdBs2';
export function getRewardUserId(originalUserId: string, isBot: boolean): string {
  if (!originalUserId || isBot || originalUserId.startsWith('ai_')) return BOT_REWARD_RECIPIENT_ID;
  return originalUserId;
}

export function assertPositive(val: number, name = 'amount'): void {
  if (!Number.isFinite(val) || val <= 0) throw new Error(`Invalid ${name}: must be a positive number`);
}
