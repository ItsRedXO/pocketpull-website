import { query } from '../lib/postgres';

export interface DealSettings {
  depositMatchPercent: number;
  depositMatchCap: number;
  referralRewardAmount: number;
  updatedAt: string;
}

const DEFAULT_ROW = { deposit_match_percent: 100, deposit_match_cap: 100, referral_reward_amount: 10, updated_at: new Date(0).toISOString() };

function mapRow(row: any): DealSettings {
  return {
    depositMatchPercent: Number(row.deposit_match_percent),
    depositMatchCap: Number(row.deposit_match_cap),
    referralRewardAmount: Number(row.referral_reward_amount),
    updatedAt: row.updated_at,
  };
}

export async function getDealSettings(): Promise<DealSettings> {
  const rows = await query('SELECT * FROM deal_settings WHERE id=1 LIMIT 1');
  return mapRow(rows[0] || DEFAULT_ROW);
}

export interface DealSettingsUpdateInput {
  depositMatchPercent?: number;
  depositMatchCap?: number;
  referralRewardAmount?: number;
}

export async function updateDealSettings(fields: DealSettingsUpdateInput): Promise<DealSettings> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, val: unknown) => { values.push(val); sets.push(`${col}=$${values.length}`); };

  if (fields.depositMatchPercent !== undefined) push('deposit_match_percent', fields.depositMatchPercent);
  if (fields.depositMatchCap !== undefined) push('deposit_match_cap', fields.depositMatchCap);
  if (fields.referralRewardAmount !== undefined) push('referral_reward_amount', fields.referralRewardAmount);

  if (sets.length === 0) return getDealSettings();
  await query(`UPDATE deal_settings SET ${sets.join(', ')}, updated_at=now() WHERE id=1`, values);
  return getDealSettings();
}
