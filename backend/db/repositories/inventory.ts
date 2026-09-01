import { getDb, type DbEnv } from '../client';

export interface InventoryCard {
  id: string;
  userId: string;
  cardId: string | null;
  cardName: string;
  rarity: string | null;
  value: number;
  emoji: string | null;
  isFavorite: boolean;
  createdAt: string;
  cardImageUrl: string | null;
  packName: string | null;
  isLocked: boolean;
  battleId: string | null;
}

function mapCard(row: any): InventoryCard {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    cardName: row.card_name,
    rarity: row.rarity,
    value: Number(row.value || 0),
    emoji: row.emoji,
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.created_at,
    cardImageUrl: row.card_image_url,
    packName: row.pack_name,
    isLocked: Boolean(row.is_locked),
    battleId: row.battle_id,
  };
}

const cardColumns = `
  id, user_id, card_id, card_name, rarity, value, emoji,
  is_favorite, created_at, card_image_url, pack_name, is_locked, battle_id
`;

export async function getInventoryCard(env: DbEnv, inventoryId: string): Promise<InventoryCard | null> {
  const result = await getDb(env).query(
    `SELECT ${cardColumns} FROM inventory WHERE id = $1 LIMIT 1`,
    [inventoryId],
  );
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function listUserInventory(env: DbEnv, userId: string): Promise<InventoryCard[]> {
  const result = await getDb(env).query(
    `SELECT ${cardColumns}
       FROM inventory
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapCard);
}

export async function updateInventoryFlags(
  env: DbEnv,
  inventoryId: string,
  userId: string,
  flags: { isLocked?: boolean; isFavorite?: boolean },
): Promise<InventoryCard | null> {
  const sets: string[] = [];
  const values: unknown[] = [inventoryId, userId];

  if (flags.isLocked !== undefined) {
    values.push(flags.isLocked);
    sets.push(`is_locked = $${values.length}`);
  }
  if (flags.isFavorite !== undefined) {
    values.push(flags.isFavorite);
    sets.push(`is_favorite = $${values.length}`);
  }
  if (!sets.length) return getInventoryCard(env, inventoryId);

  const result = await getDb(env).query(
    `UPDATE inventory
        SET ${sets.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING ${cardColumns}`,
    values,
  );
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function deleteInventoryCard(
  env: DbEnv,
  inventoryId: string,
  userId: string,
): Promise<InventoryCard | null> {
  const result = await getDb(env).query(
    `DELETE FROM inventory
      WHERE id = $1 AND user_id = $2 AND is_locked = FALSE
      RETURNING ${cardColumns}`,
    [inventoryId, userId],
  );
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function deleteAllUnlockedInventory(
  env: DbEnv,
  userId: string,
): Promise<InventoryCard[]> {
  const result = await getDb(env).query(
    `DELETE FROM inventory
      WHERE user_id = $1 AND is_locked = FALSE
      RETURNING ${cardColumns}`,
    [userId],
  );
  return result.rows.map(mapCard);
}
