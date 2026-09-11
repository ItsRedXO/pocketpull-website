import { query, transaction } from '../lib/postgres';
import { BRAWL_ITEMS, ITEM_MAP, pickShopItems, SHOP_ROTATION_MS, type BrawlItemDef } from '../lib/brawl/items';
import { applyBrawlWalletTransaction, getWalletBalance } from './brawl';

interface ShopStateRow { id: number; item_keys: string[]; rotated_at: string; }

export interface ShopStatus { items: BrawlItemDef[]; rotatedAt: string; nextRotateAt: string; }

/**
 * Lazily rotates the shared shop stock once 24h have passed since the last
 * rotation -- same "fill in on read, no background job" pattern as
 * Challenges. Every player reads the same row, so the stock (and countdown)
 * is identical for everyone until the next rotation.
 */
export async function getShopStatus(): Promise<ShopStatus> {
  return transaction(async client => {
    let row = (await client.query('SELECT * FROM brawl_item_shop_state WHERE id=1 FOR UPDATE')).rows[0] as ShopStateRow | undefined;
    if (!row) {
      row = (await client.query('INSERT INTO brawl_item_shop_state (id) VALUES (1) RETURNING *')).rows[0];
    }
    const stale = !row!.item_keys?.length || new Date(row!.rotated_at).getTime() + SHOP_ROTATION_MS <= Date.now();
    if (stale) {
      const itemKeys = pickShopItems();
      const rotatedAt = new Date();
      await client.query('UPDATE brawl_item_shop_state SET item_keys=$1, rotated_at=$2 WHERE id=1', [itemKeys, rotatedAt]);
      row = { ...row!, item_keys: itemKeys, rotated_at: rotatedAt.toISOString() };
    }
    const items = row!.item_keys.map(k => ITEM_MAP[k]).filter((i): i is BrawlItemDef => !!i);
    return { items, rotatedAt: row!.rotated_at, nextRotateAt: new Date(new Date(row!.rotated_at).getTime() + SHOP_ROTATION_MS).toISOString() };
  });
}

export interface InventoryEntry { itemKey: string; quantity: number; item: BrawlItemDef; }
export async function getInventory(userId: string): Promise<InventoryEntry[]> {
  const rows = await query<{ item_key: string; quantity: number }>(
    'SELECT item_key, quantity FROM brawl_item_inventory WHERE user_id=$1 AND quantity > 0',
    [userId],
  );
  return rows
    .map(r => ({ itemKey: r.item_key, quantity: Number(r.quantity), item: ITEM_MAP[r.item_key] }))
    .filter((e): e is InventoryEntry => !!e.item);
}

export interface BuyResult { balance: number; quantity: number; }
/**
 * Buys 1 copy of `itemKey`, provided it's part of today's shop rotation.
 * Wallet debit and inventory credit are 2 separate small writes (not one
 * transaction) -- same non-atomic-but-low-risk tradeoff the Safari Zone pull
 * already makes for debit-then-grant.
 */
export async function buyItem(userId: string, itemKey: string): Promise<BuyResult> {
  const item = ITEM_MAP[itemKey];
  if (!item) throw new Error('UNKNOWN_ITEM');

  const shopRow = (await query<{ item_keys: string[] }>('SELECT item_keys FROM brawl_item_shop_state WHERE id=1'))[0];
  if (!shopRow || !shopRow.item_keys.includes(itemKey)) throw new Error('NOT_IN_SHOP');

  await applyBrawlWalletTransaction(userId, 'item_purchase', -item.price, `item:${itemKey}:${userId}:${Date.now()}`, { itemKey });

  const result = await query<{ quantity: string }>(
    `INSERT INTO brawl_item_inventory (user_id, item_key, quantity) VALUES ($1,$2,1)
     ON CONFLICT (user_id, item_key) DO UPDATE SET quantity = brawl_item_inventory.quantity + 1, updated_at = now()
     RETURNING quantity`,
    [userId, itemKey],
  );
  const balance = await getWalletBalance(userId);
  return { balance, quantity: Number(result[0].quantity) };
}
