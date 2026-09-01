import { query, transaction } from '../lib/postgres';

export async function getUser(id: string) { const rows = await query('SELECT * FROM users WHERE id=$1', [id]); return rows[0] || null; }
export async function updateUser(id: string, fields: Record<string, unknown>) {
  const allowed: Record<string,string> = { username:'username', displayName:'display_name', email:'email', balance:'balance', matchedBalance:'matched_balance', isDeleted:'is_deleted', isBanned:'is_banned', firstDepositBonusPaid:'first_deposit_bonus_paid', referralRewardPaid:'referral_reward_paid', referredById:'referred_by_id', referralCode:'referral_code' };
  const entries = Object.entries(fields).filter(([k]) => allowed[k]);
  if (!entries.length) return getUser(id);
  const sets = entries.map(([k], i) => `${allowed[k]}=$${i+1}`).join(', ');
  const values = entries.map(([,v]) => v);
  values.push(id);
  const rows = await query(`UPDATE users SET ${sets},updated_at=now() WHERE id=$${values.length} RETURNING *`, values);
  return rows[0] || null;
}
export async function listUsersByReferrer(userId: string, limit: number, offset: number) { return query('SELECT * FROM users WHERE referred_by_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId,limit,offset]); }
export async function countUsersByReferrer(userId: string) { const r=await query<{count:string}>('SELECT count(*)::text count FROM users WHERE referred_by_id=$1',[userId]); return Number(r[0]?.count||0); }
export async function hasDeposit(userId:string, minimum?:number) { const sql=minimum===undefined?'SELECT 1 FROM transactions WHERE user_id=$1 AND type=$2 LIMIT 1':'SELECT 1 FROM transactions WHERE user_id=$1 AND type=$2 AND amount >= $3 LIMIT 1'; const p=minimum===undefined?[userId,'deposit']:[userId,'deposit',minimum]; return (await query(sql,p)).length>0; }
