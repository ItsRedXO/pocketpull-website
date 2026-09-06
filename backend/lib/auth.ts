import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';
import { getUser } from '../repositories/users';
import { postgresBlinkDb } from './postgresBlinkDb';
import { verifySupabaseToken, extractSupabaseBearer } from './supabaseAuth';
import { query } from './postgres';

/**
 * Resolves the Authorization header to a usr_XXXX id, trying Blink first
 * (unchanged behavior for the ~70 accounts not yet migrated) and falling
 * back to a Supabase Auth token (via auth_user_id lookup) if Blink
 * verification fails. Phase 2 of the Blink -> Supabase Auth migration:
 * both paths are accepted side by side until the frontend cutover (Phase 3).
 */
export async function resolveUserId(c: Context): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  const blink = getBlinkServer(c.env as any);
  try {
    const auth = await blink.auth.verifyToken(authHeader);
    if (auth.valid && auth.userId) return auth.userId;
  } catch {}

  try {
    const token = extractSupabaseBearer(authHeader);
    const claims = await verifySupabaseToken(token);
    const rows = await query<{ id: string }>('SELECT id FROM users WHERE auth_user_id=$1 LIMIT 1', [claims.authUserId]);
    if (rows[0]?.id) return rows[0].id;
  } catch {}

  return null;
}

export async function requireAuth(c: Context): Promise<string> {
  const userId = await resolveUserId(c);
  if (!userId) throw new Error('UNAUTHORIZED');
  try {
    const user = await getUser(userId);
    if (user && Number(user.is_deleted || 0) > 0) throw new Error('ACCOUNT_DEACTIVATED');
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') throw err;
  }
  return userId;
}

/** Blink remains the authentication provider; application data is PostgreSQL-backed. */
export function getBlinkServer(env: Record<string,string> = {}) {
  const runtimeEnv: Record<string,string> = {
    ...(typeof process !== 'undefined' ? process.env as Record<string,string> : {}),
    ...(env || {}),
  };
  if (runtimeEnv.DATABASE_URL && typeof process !== 'undefined') process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  const client: any = createClient({ projectId: runtimeEnv.BLINK_PROJECT_ID, secretKey: runtimeEnv.BLINK_SECRET_KEY });
  return new Proxy(client, {
    get(target, property, receiver) {
      return property === 'db' ? postgresBlinkDb : Reflect.get(target, property, receiver);
    },
  });
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
