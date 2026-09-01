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

const cardColumns = `id, user_id, card_id, card_name, rarity, value, emoji, is_favorite, created_at, card_image_url, pack_name, is_locked, battle_id`;

export async function getInventoryCard(env: DbEnv, inventoryId: string): Promise<InventoryCard | null> {
  const result = await getDb(env).query(`SELECT ${cardColumns} FROM inventory WHERE id = $1 LIMIT 1`, [inventoryId]);
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function listUserInventory(env: DbEnv, userId: string): Promise<InventoryCard[]> {
  const result = await getDb(env).query(`SELECT ${cardColumns} FROM inventory WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return result.rows.map(mapCard);
}

export async function updateInventoryFlags(env: DbEnv, inventoryId: string, userId: string, flags: { isLocked?: boolean; isFavorite?: boolean }): Promise<InventoryCard | null> {
  const sets: string[] = [];
  const values: unknown[] = [inventoryId, userId];
  if (flags.isLocked !== undefined) { values.push(flags.isLocked); sets.push(`is_locked = $${values.length}`); }
  if (flags.isFavorite !== undefined) { values.push(flags.isFavorite); sets.push(`is_favorite = $${values.length}`); }
  if (!sets.length) return getInventoryCard(env, inventoryId);
  const result = await getDb(env).query(`UPDATE inventory SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING ${cardColumns}`, values);
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function deleteInventoryCard(env: DbEnv, inventoryId: string, userId: string): Promise<InventoryCard | null> {
  const result = await getDb(env).query(`DELETE FROM inventory WHERE id = $1 AND user_id = $2 AND is_locked = FALSE RETURNING ${cardColumns}`, [inventoryId, userId]);
  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

export async function deleteAllUnlockedInventory(env: DbEnv, userId: string): Promise<InventoryCard[]> {
  const result = await getDb(env).query(`DELETE FROM inventory WHERE user_id = $1 AND is_locked = FALSE RETURNING ${cardColumns}`, [userId]);
  return result.rows.map(mapCard);
}

export async function sellInventoryCard(env: DbEnv, inventoryId: string, userId: string): Promise<{ card: InventoryCard; newBalance: number; transactionId: string }> {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const cardResult = await client.query(`SELECT ${cardColumns} FROM inventory WHERE id = $1 AND user_id = $2 FOR UPDATE`, [inventoryId, userId]);
    const card = cardResult.rows[0];
    if (!card) throw new Error('Card not found');
    if (Boolean(card.is_locked)) throw new Error('Card is locked and cannot be sold');

    const userResult = await client.query(`SELECT balance, matched_balance, is_deleted, is_banned FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const user = userResult.rows[0];
    if (!user) throw new Error('User not found');
    if (user.is_deleted) throw new Error('Account deactivated');
    if (user.is_banned) throw new Error('Account banned');

    const value = Number(card.value || 0);
    const balanceBefore = Number(user.balance || 0);
    const matchedBefore = Number(user.matched_balance || 0);
    const newBalance = balanceBefore + value;
    const ledgerId = `wt_sell_${userId}_${inventoryId}`;
    const transactionId = `txn_sell_${inventoryId}`;

    const existing = await client.query(`SELECT balance_after, matched_after FROM wallet_transactions WHERE id = $1`, [ledgerId]);
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return { card: mapCard(card), newBalance: Number(existing.rows[0].balance_after), transactionId };
    }

    await client.query(`DELETE FROM inventory WHERE id = $1`, [inventoryId]);
    await client.query(`UPDATE users SET balance = $2, updated_at = NOW() WHERE id = $1`, [userId, newBalance]);
    await client.query(`INSERT INTO wallet_transactions (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES ($1,$2,'sell',$3,$4,$5,$6,$6,$7,$8::jsonb,NOW())`, [ledgerId, userId, value, balanceBefore, newBalance, matchedBefore, inventoryId, JSON.stringify({ cardName: card.card_name })]);
    await client.query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,'sell',$3,$4,NOW())`, [transactionId, userId, value, `Sold ${card.card_name} from inventory |img:${card.card_image_url || ''}|`]);
    await client.query('COMMIT');
    return { card: mapCard(card), newBalance, transactionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function sellAllUnlockedInventory(env: DbEnv, userId: string): Promise<{ cards: InventoryCard[]; totalValue: number; newBalance: number }> {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(`SELECT balance, matched_balance, is_deleted, is_banned FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const user = userResult.rows[0];
    if (!user) throw new Error('User not found');
    if (user.is_deleted) throw new Error('Account deactivated');
    if (user.is_banned) throw new Error('Account banned');

    const cardsResult = await client.query(`SELECT ${cardColumns} FROM inventory WHERE user_id = $1 AND is_locked = FALSE FOR UPDATE`, [userId]);
    const cards = cardsResult.rows.map(mapCard);
    if (!cards.length) throw new Error('No unlocked cards to sell');

    const totalValue = cards.reduce((sum, card) => sum + card.value, 0);
    const newBalance = Number(user.balance || 0) + totalValue;
    const sourceId = `sell_all_${userId}_${Date.now()}`;
    const ledgerId = `wt_sell_all_${userId}_${sourceId}`;
    const transactionId = `txn_sell_all_${userId}_${Date.now()}`;

    await client.query(`DELETE FROM inventory WHERE user_id = $1 AND is_locked = FALSE`, [userId]);
    await client.query(`UPDATE users SET balance = $2, updated_at = NOW() WHERE id = $1`, [userId, newBalance]);
    await client.query(`INSERT INTO wallet_transactions (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES ($1,$2,'sell_all',$3,$4,$5,$6,$6,$7,$8::jsonb,NOW())`, [ledgerId, userId, totalValue, Number(user.balance || 0), newBalance, Number(user.matched_balance || 0), sourceId, JSON.stringify({ count: cards.length })]);
    await client.query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,'sell',$3,$4,NOW())`, [transactionId, userId, totalValue, `Sold all ${cards.length} unlocked card(s) from inventory`]);
    await client.query('COMMIT');
    return { cards, totalValue, newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
