import { query, transaction } from '../lib/postgres';
import { uid } from '../lib/auth';
import { processWalletTransactionInClient } from './wallet';

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  rewardAmount: number;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapCode(row: any): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    rewardAmount: Number(row.reward_amount),
    maxUses: row.max_uses === null ? null : Number(row.max_uses),
    useCount: Number(row.use_count),
    isActive: Number(row.is_active) === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const rows = await query('SELECT * FROM promo_codes ORDER BY created_at DESC');
  return rows.map(mapCode);
}

export interface CreatePromoCodeInput {
  code: string;
  description?: string | null;
  rewardAmount: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  createdBy?: string;
}

export async function createPromoCode(input: CreatePromoCodeInput): Promise<PromoCode> {
  const id = `promo_${uid()}`;
  const code = input.code.trim().toUpperCase();
  const rows = await query(
    `INSERT INTO promo_codes(id,code,description,reward_amount,max_uses,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, code, input.description || null, input.rewardAmount, input.maxUses ?? null, input.expiresAt || null, input.createdBy || null],
  );
  return mapCode(rows[0]);
}

export interface UpdatePromoCodeInput {
  description?: string | null;
  rewardAmount?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export async function updatePromoCode(id: string, fields: UpdatePromoCodeInput): Promise<PromoCode | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, val: unknown) => { values.push(val); sets.push(`${col}=$${values.length}`); };

  if (fields.description !== undefined) push('description', fields.description);
  if (fields.rewardAmount !== undefined) push('reward_amount', fields.rewardAmount);
  if (fields.maxUses !== undefined) push('max_uses', fields.maxUses);
  if (fields.expiresAt !== undefined) push('expires_at', fields.expiresAt);
  if (fields.isActive !== undefined) push('is_active', fields.isActive ? 1 : 0);
  if (sets.length === 0) {
    const rows = await query('SELECT * FROM promo_codes WHERE id=$1', [id]);
    return rows[0] ? mapCode(rows[0]) : null;
  }
  values.push(id);
  const rows = await query(`UPDATE promo_codes SET ${sets.join(', ')}, updated_at=now() WHERE id=$${values.length} RETURNING *`, values);
  return rows[0] ? mapCode(rows[0]) : null;
}

export type DeletePromoCodeResult = { success: true } | { success: false; error: string };

// Hard delete is only safe for a code nobody has used yet -- redemptions
// carry a real credited transaction (the money was already paid out and
// stays in the ledger regardless), so dropping the code out from under a
// redemption row would blow away the "who used this" history for no
// financial reason. A used code should be deactivated instead.
export async function deletePromoCode(id: string): Promise<DeletePromoCodeResult> {
  const rows = await query<{ use_count: number }>('SELECT use_count FROM promo_codes WHERE id=$1', [id]);
  if (!rows[0]) return { success: false, error: 'Code not found' };
  if (Number(rows[0].use_count) > 0) return { success: false, error: 'This code has been redeemed — deactivate it instead of deleting so its history stays intact.' };
  await query('DELETE FROM promo_codes WHERE id=$1', [id]);
  return { success: true };
}

export interface PromoCodeRedemption {
  userId: string;
  username: string | null;
  email: string | null;
  amount: number;
  redeemedAt: string;
}

export async function listPromoCodeRedemptions(codeId: string): Promise<PromoCodeRedemption[]> {
  const rows = await query(
    `SELECT r.user_id, r.amount, r.redeemed_at, u.username, u.display_name, u.email
     FROM promo_code_redemptions r JOIN users u ON u.id = r.user_id
     WHERE r.code_id = $1 ORDER BY r.redeemed_at DESC`,
    [codeId],
  );
  return rows.map((row: any) => ({
    userId: row.user_id,
    username: row.username || row.display_name || null,
    email: row.email,
    amount: Number(row.amount),
    redeemedAt: row.redeemed_at,
  }));
}

export type ValidateCodeResult =
  | { success: true }
  | { success: false; error: string };

export async function validateAndConsumeCodeInClient(
  client: any,
  userId: string,
  rawCode: string,
): Promise<ValidateCodeResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, error: 'Enter a code' };

  const codeRows = await client.query('SELECT * FROM promo_codes WHERE code=$1 FOR UPDATE', [code]);
  const promo = codeRows.rows[0];
  if (!promo) return { success: false, error: 'Invalid code' };
  if (Number(promo.is_active) !== 1) return { success: false, error: 'This code is no longer active' };
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return { success: false, error: 'This code has expired' };
  if (promo.max_uses !== null && Number(promo.use_count) >= Number(promo.max_uses)) return { success: false, error: 'This code has reached its usage limit' };

  const already = await client.query('SELECT 1 FROM promo_code_redemptions WHERE code_id=$1 AND user_id=$2', [promo.id, userId]);
  if (already.rowCount) return { success: false, error: "You've already used this code" };

  const redemptionId = `promoredeem_${uid()}`;
  await client.query('INSERT INTO promo_code_redemptions(id,code_id,user_id,amount) VALUES($1,$2,$3,$4)', [redemptionId, promo.id, userId, 0]);
  await client.query('UPDATE promo_codes SET use_count=use_count+1, updated_at=now() WHERE id=$1', [promo.id]);

  return { success: true };
}

export type RedeemPromoCodeResult =
  | { success: true; amount: number; balance: number; code: string }
  | { success: false; error: string };

export async function redeemPromoCode(userId: string, rawCode: string): Promise<RedeemPromoCodeResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, error: 'Enter a code' };

  return transaction(async client => {
    const codeRows = await client.query('SELECT * FROM promo_codes WHERE code=$1 FOR UPDATE', [code]);
    const promo = codeRows.rows[0];
    if (!promo) return { success: false, error: 'Invalid code' };
    if (Number(promo.is_active) !== 1) return { success: false, error: 'This code is no longer active' };
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return { success: false, error: 'This code has expired' };
    if (promo.max_uses !== null && Number(promo.use_count) >= Number(promo.max_uses)) return { success: false, error: 'This code has reached its usage limit' };

    const already = await client.query('SELECT 1 FROM promo_code_redemptions WHERE code_id=$1 AND user_id=$2', [promo.id, userId]);
    if (already.rowCount) return { success: false, error: "You've already used this code" };

    const amount = Number(promo.reward_amount);
    const sourceId = `promo_${promo.id}_${userId}`;
    const wallet = await processWalletTransactionInClient(client, { userId, type: 'promo_code_redeem', amount, sourceId, metadata: { code } });
    if (!wallet.success) return { success: false, error: wallet.error || 'Failed to credit reward' };

    const redemptionId = `promoredeem_${uid()}`;
    await client.query('INSERT INTO promo_code_redemptions(id,code_id,user_id,amount) VALUES($1,$2,$3,$4)', [redemptionId, promo.id, userId, amount]);
    await client.query('UPDATE promo_codes SET use_count=use_count+1, updated_at=now() WHERE id=$1', [promo.id]);
    await client.query(
      "INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,'promo_code_redeem',$3,$4,$5,now())",
      [sourceId, userId, amount, `Promo Code — ${code}`, sourceId],
    );

    return { success: true, amount, balance: wallet.balanceAfter, code };
  });
}
