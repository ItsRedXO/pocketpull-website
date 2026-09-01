import type { Context } from 'hono';
import { createClient } from '@blinkdotnew/sdk';
import { getUser } from '../repositories/users';
import { postgresBlinkDb } from './postgresBlinkDb';

export async function requireAuth(c: Context): Promise<string> {
  const blink = getBlinkServer(c.env as any);
  const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
  if (!auth.valid || !auth.userId) throw new Error('UNAUTHORIZED');
  try {
    const user = await getUser(auth.userId);
    if (user && Number(user.is_deleted || 0) > 0) throw new Error('ACCOUNT_DEACTIVATED');
  } catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') throw err; }
  return auth.userId;
}

/**
 * Blink remains the authentication provider, but ALL application DB access
 * exposed through the legacy blink.db API is now backed by PostgreSQL.
 */
export function getBlinkServer(env: Record<string,string>) {
  const client: any = createClient({ projectId: env.BLINK_PROJECT_ID, secretKey: env.BLINK_SECRET_KEY });
  return new Proxy(client, { get(target, property, receiver) { return property === 'db' ? postgresBlinkDb : Reflect.get(target, property, receiver); } });
}

export function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
export function generateReferralCode(): string { const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let code=''; for(let i=0;i<8;i++) code += chars.charAt(Math.floor(Math.random()*chars.length)); return code; }
export const BOT_REWARD_RECIPIENT_ID='usr_ro8OEE9fdBs2';
export function getRewardUserId(originalUserId:string,isBot:boolean){if(!originalUserId)return BOT_REWARD_RECIPIENT_ID;if(isBot||originalUserId.startsWith('ai_'))return BOT_REWARD_RECIPIENT_ID;return originalUserId;}
export function assertPositive(val:number,name='amount'){if(!Number.isFinite(val)||val<=0)throw new Error(`Invalid ${name}: must be a positive number`);}
