import { query } from './postgres';
import { uid } from './auth';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculatePackOpenGems(estimatedValue: number): number {
  const value = Math.max(0, estimatedValue);
  let base: number;
  if (value <= 2) base = randInt(2, 6);
  else if (value <= 5) base = randInt(3, 9);
  else if (value <= 15) base = randInt(5, 16);
  else if (value <= 30) base = randInt(8, 22);
  else if (value <= 100) base = randInt(12, 32);
  else base = randInt(20, 52);
  if (Math.random() < 0.05) base = Math.floor(base * 2);
  return base;
}

export function calculateUpgraderGems(isWin: boolean): number {
  return randInt(8, 19) + (isWin ? randInt(5, 12) : 0);
}

export function calculateBattleGems(isWinner: boolean): number {
  return randInt(10, 26) + (isWinner ? randInt(5, 16) : 0);
}

export function calculateBrawlGems(): number {
  return randInt(2, 9);
}

export async function awardGemsInClient(
  client: any,
  userId: string,
  amount: number,
  sourceType: string,
  sourceId: string,
): Promise<number> {
  if (amount <= 0) return 0;
  const result = await client.query(
    `UPDATE users SET gems = COALESCE(gems, 0) + $1 WHERE id = $2
     RETURNING gems, (gems - $1) AS gems_before`,
    [amount, userId],
  );
  if (!result.rowCount) return 0;
  const newGems = Number(result.rows[0].gems);
  const gemsBefore = Number(result.rows[0].gems_before);
  await client.query(
    `INSERT INTO gem_transactions(id, user_id, amount, balance_before, balance_after, source_type, source_id)
     VALUES($1, $2, $3, $4, $5, $6, $7)`,
    [`gem_${uid()}`, userId, amount, gemsBefore, newGems, sourceType, sourceId],
  );
  return newGems;
}

export async function deductGemsInClient(
  client: any,
  userId: string,
  amount: number,
  sourceType: string,
  sourceId: string,
): Promise<{ success: boolean; newGems: number; error?: string }> {
  const check = await client.query(`SELECT gems FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  const currentGems = Number(check.rows[0]?.gems || 0);
  if (currentGems < amount) return { success: false, newGems: currentGems, error: 'Insufficient gems' };
  const result = await client.query(
    `UPDATE users SET gems = gems - $1 WHERE id = $2 RETURNING gems`,
    [amount, userId],
  );
  const newGems = Number(result.rows[0]?.gems || 0);
  await client.query(
    `INSERT INTO gem_transactions(id, user_id, amount, balance_before, balance_after, source_type, source_id)
     VALUES($1, $2, $3, $4, $5, $6, $7)`,
    [`gem_${uid()}`, userId, -amount, currentGems, newGems, sourceType, sourceId],
  );
  return { success: true, newGems };
}

export async function awardGems(
  userId: string,
  amount: number,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  if (amount <= 0) return;
  await query(
    `WITH updated AS (
       UPDATE users SET gems = COALESCE(gems, 0) + $1 WHERE id = $2
       RETURNING gems, (gems - $1) AS gems_before
     )
     INSERT INTO gem_transactions(id, user_id, amount, balance_before, balance_after, source_type, source_id)
     SELECT $3, $2, $1, updated.gems_before, updated.gems, $4, $5
     FROM updated`,
    [amount, userId, `gem_${uid()}`, sourceType, sourceId],
  );
}
