import { query } from '../lib/postgres';

export async function getUser(id: string) { const rows = await query('SELECT * FROM users WHERE id=$1', [id]); return rows[0] || null; }
export async function listUsersByReferrer(userId: string, limit: number, offset: number) { return query('SELECT * FROM users WHERE referred_by_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId,limit,offset]); }
export async function countUsersByReferrer(userId: string) { const r=await query<{count:string}>('SELECT count(*)::text count FROM users WHERE referred_by_id=$1',[userId]); return Number(r[0]?.count||0); }
export async function hasDeposit(userId:string, minimum?:number) { const sql=minimum===undefined?'SELECT 1 FROM transactions WHERE user_id=$1 AND type=$2 LIMIT 1':'SELECT 1 FROM transactions WHERE user_id=$1 AND type=$2 AND amount >= $3 LIMIT 1'; const p=minimum===undefined?[userId,'deposit']:[userId,'deposit',minimum]; return (await query(sql,p)).length>0; }
