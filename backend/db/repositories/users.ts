import { query, getDb, type DbEnv } from '../client';

export interface UserAuthState {
  id: string;
  isDeleted: boolean;
  isBanned: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  balance: number;
  matchedBalance: number;
  isDeleted: boolean;
  isBanned: boolean;
  firstDepositBonusPaid: boolean;
  referralRewardPaid: boolean;
  referredById: string | null;
}

export async function getUserAuthState(env: DbEnv, userId: string): Promise<UserAuthState | null> {
  const result = await query<{ id: string; is_deleted: boolean; is_banned: boolean }>(
    env,
    'SELECT id, is_deleted, is_banned FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, isDeleted: Boolean(row.is_deleted), isBanned: Boolean(row.is_banned) };
}

export async function getUserProfile(env: DbEnv, userId: string): Promise<UserProfile | null> {
  const result = await query<any>(env, `
    SELECT id, email, COALESCE(username, '') AS username, COALESCE(display_name, '') AS display_name,
           role, balance, matched_balance, is_deleted, is_banned,
           first_deposit_bonus_paid, referral_reward_paid, referred_by_id
      FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || '',
    username: row.username || '',
    displayName: row.display_name || '',
    role: row.role || 'user',
    balance: Number(row.balance || 0),
    matchedBalance: Number(row.matched_balance || 0),
    isDeleted: Boolean(row.is_deleted),
    isBanned: Boolean(row.is_banned),
    firstDepositBonusPaid: Boolean(row.first_deposit_bonus_paid),
    referralRewardPaid: Boolean(row.referral_reward_paid),
    referredById: row.referred_by_id || null,
  };
}

export async function listReferredUsers(env: DbEnv, userId: string, limit: number, offset: number) {
  const result = await query<any>(env, `
    SELECT id, email, username, display_name, referral_reward_paid, is_deleted, created_at
      FROM users WHERE referred_by_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
  const count = await query<{ count: string }>(env, 'SELECT COUNT(*)::text AS count FROM users WHERE referred_by_id = $1', [userId]);
  return { rows: result.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function hasDepositOfAtLeast(env: DbEnv, userId: string, minimum: number): Promise<boolean> {
  const result = await query<{ exists: boolean }>(env, `
    SELECT EXISTS(
      SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'deposit' AND amount >= $2
    ) AS exists`, [userId, minimum]);
  return Boolean(result.rows[0]?.exists);
}
