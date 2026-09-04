import type { Context } from 'hono';
import { jwtVerify } from 'jose';
import { getUser } from '../repositories/users';

function getRuntimeEnv(env: Record<string, string> = {}) {
  return {
    ...(typeof process !== 'undefined' ? process.env as Record<string, string> : {}),
    ...(env || {}),
  };
}

function getJwtSecret(env: Record<string, string>) {
  const secret = env.SUPABASE_JWT_SECRET || env.JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function requireAuth(c: Context): Promise<string> {
  const authorization = c.req.header('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHORIZED');

  const env = getRuntimeEnv(c.env as Record<string, string>);
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, getJwtSecret(env), {
      algorithms: ['HS256'],
      issuer: env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1` : undefined,
      audience: 'authenticated',
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    throw new Error('UNAUTHORIZED');
  }

  const userId = String(payload.sub || '');
  if (!userId) throw new Error('UNAUTHORIZED');

  try {
    const user = await getUser(userId);
    if (user && Number(user.is_deleted || 0) > 0) throw new Error('ACCOUNT_DEACTIVATED');
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') throw err;
  }
  return userId;
}

/** Legacy call-site compatibility only. No Blink SDK or network/database client is used. */
export function getBlinkServer(_env?: Record<string, unknown>): null {
  return null;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export const BOT_REWARD_RECIPIENT_ID = 'usr_ro8OEE9fdBs2';
export function getRewardUserId(originalUserId: string, isBot: boolean) {
  if (!originalUserId) return BOT_REWARD_RECIPIENT_ID;
  if (isBot || originalUserId.startsWith('ai_')) return BOT_REWARD_RECIPIENT_ID;
  return originalUserId;
}
export function assertPositive(val: number, name = 'amount') {
  if (!Number.isFinite(val) || val <= 0) throw new Error(`Invalid ${name}: must be a positive number`);
}