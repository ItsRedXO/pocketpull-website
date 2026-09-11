import { query, transaction } from '../lib/postgres';
import { pickShopItems, type BrawlItemDef, type ItemRarity, type ItemKind } from '../lib/brawl/items';
import { applyBrawlWalletTransaction, getWalletBalance } from './brawl';
import { startOfDayInZone, nextResetAt } from '../lib/dailyReset';

export interface ItemRow {
  key: string; name: string; description: string; rarity: ItemRarity; kind: ItemKind;
  price: number; sprite_url: string | null; active: boolean;
}

function toDef(row: ItemRow): BrawlItemDef {
  return { key: row.key, name: row.name, description: row.description, rarity: row.rarity, kind: row.kind, price: row.price, spriteUrl: row.sprite_url, active: row.active };
}

export async function listAllItems(): Promise<ItemRow[]> {
  return query<ItemRow>('SELECT * FROM brawl_items ORDER BY rarity, price, name');
}
export async function getItemsByKeys(keys: string[]): Promise<ItemRow[]> {
  if (!keys.length) return [];
  return query<ItemRow>('SELECT * FROM brawl_items WHERE key = ANY($1)', [keys]);
}

interface ShopStateRow { id: number; item_keys: string[]; next_item_keys: string[]; rotated_at: string; }

export interface ShopStatus { items: BrawlItemDef[]; rotatedAt: string; nextRotateAt: string; }

/**
 * Lazily rotates the shared shop stock once today's midnight-Pacific
 * boundary has passed since the last rotation -- "fill in on read, no
 * background job" pattern, same as Challenges. Anchored to a fixed
 * wall-clock moment (not a rolling 24h-since-last-rotation timer) so it
 * resets at the same instant every night regardless of when a player or
 * admin last touched it -- same boundary the daily battle cap uses (see
 * countRunsToday), by design. Promotes whatever admins staged in
 * next_item_keys (or rolls a fresh set if nothing was staged), then
 * immediately stages a new "next" batch so there's always something to
 * preview/edit ahead of the following rotation.
 */
export async function getShopStatus(): Promise<ShopStatus> {
  return transaction(async client => {
    let row = (await client.query('SELECT * FROM brawl_item_shop_state WHERE id=1 FOR UPDATE')).rows[0] as ShopStateRow | undefined;
    if (!row) row = (await client.query('INSERT INTO brawl_item_shop_state (id) VALUES (1) RETURNING *')).rows[0];
    const allItems = await listAllItems();

    const stale = !row!.item_keys?.length || new Date(row!.rotated_at).getTime() < startOfDayInZone(new Date()).getTime();
    if (stale) {
      const promoted = row!.next_item_keys?.length ? row!.next_item_keys : pickShopItems(allItems.map(toDef));
      const freshNext = pickShopItems(allItems.map(toDef));
      const rotatedAt = new Date();
      await client.query('UPDATE brawl_item_shop_state SET item_keys=$1, next_item_keys=$2, rotated_at=$3 WHERE id=1', [promoted, freshNext, rotatedAt]);
      row = { ...row!, item_keys: promoted, next_item_keys: freshNext, rotated_at: rotatedAt.toISOString() };
    } else if (!row!.next_item_keys?.length) {
      const freshNext = pickShopItems(allItems.map(toDef));
      await client.query('UPDATE brawl_item_shop_state SET next_item_keys=$1 WHERE id=1', [freshNext]);
      row = { ...row!, next_item_keys: freshNext };
    }

    const byKey = new Map(allItems.map(i => [i.key, i]));
    const items = row!.item_keys.map(k => byKey.get(k)).filter((i): i is ItemRow => !!i).map(toDef);
    return { items, rotatedAt: row!.rotated_at, nextRotateAt: nextResetAt(new Date()).toISOString() };
  });
}

export interface InventoryEntry { itemKey: string; quantity: number; item: BrawlItemDef; }
export async function getInventory(userId: string): Promise<InventoryEntry[]> {
  const rows = await query<{ item_key: string; quantity: number; key: string; name: string; description: string; rarity: ItemRarity; kind: ItemKind; price: number; sprite_url: string | null; active: boolean }>(
    `SELECT inv.item_key, inv.quantity, i.key, i.name, i.description, i.rarity, i.kind, i.price, i.sprite_url, i.active
     FROM brawl_item_inventory inv JOIN brawl_items i ON i.key = inv.item_key
     WHERE inv.user_id=$1 AND inv.quantity > 0`,
    [userId],
  );
  return rows.map(r => ({ itemKey: r.item_key, quantity: Number(r.quantity), item: toDef(r) }));
}

export interface BuyResult { balance: number; quantity: number; }
/**
 * Buys 1 copy of `itemKey`, provided it's part of today's shop rotation.
 * Wallet debit and inventory credit are 2 separate small writes (not one
 * transaction) -- same non-atomic-but-low-risk tradeoff the Safari Zone pull
 * already makes for debit-then-grant.
 */
export async function buyItem(userId: string, itemKey: string): Promise<BuyResult> {
  const item = (await query<ItemRow>('SELECT * FROM brawl_items WHERE key=$1', [itemKey]))[0];
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

// ---- Admin: catalog CRUD + shop slate management ------------------------

const ITEM_EDITABLE_FIELDS = new Set(['name', 'description', 'rarity', 'kind', 'price', 'sprite_url', 'active']);
export async function adminCreateItem(fields: Record<string, unknown>): Promise<ItemRow> {
  return (await query<ItemRow>(
    `INSERT INTO brawl_items (key, name, description, rarity, kind, price, sprite_url, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [fields.key, fields.name, fields.description, fields.rarity, fields.kind || 'other', fields.price, fields.sprite_url || null, !!fields.active],
  ))[0];
}
export async function adminUpdateItem(key: string, fields: Record<string, unknown>): Promise<ItemRow | null> {
  const entries = Object.entries(fields).filter(([k]) => ITEM_EDITABLE_FIELDS.has(k));
  if (!entries.length) return (await query<ItemRow>('SELECT * FROM brawl_items WHERE key=$1', [key]))[0] || null;
  const sets = entries.map(([k], i) => `${k}=$${i + 1}`).join(',');
  const params: unknown[] = entries.map(([, v]) => v);
  params.push(key);
  return (await query<ItemRow>(`UPDATE brawl_items SET ${sets}, updated_at=now() WHERE key=$${params.length} RETURNING *`, params))[0] || null;
}
export async function adminDeleteItem(key: string): Promise<void> {
  await query('DELETE FROM brawl_items WHERE key=$1', [key]);
}

export interface AdminShopStatus {
  current: { itemKeys: string[]; items: BrawlItemDef[]; rotatedAt: string };
  next: { itemKeys: string[]; items: BrawlItemDef[] };
  nextRotateAt: string;
}
export async function adminGetShopStatus(): Promise<AdminShopStatus> {
  const status = await getShopStatus();
  const row = (await query<ShopStateRow>('SELECT * FROM brawl_item_shop_state WHERE id=1'))[0];
  const allItems = await listAllItems();
  const byKey = new Map(allItems.map(i => [i.key, i]));
  return {
    current: { itemKeys: row.item_keys, items: row.item_keys.map(k => byKey.get(k)).filter((i): i is ItemRow => !!i).map(toDef), rotatedAt: row.rotated_at },
    next: { itemKeys: row.next_item_keys, items: row.next_item_keys.map(k => byKey.get(k)).filter((i): i is ItemRow => !!i).map(toDef) },
    nextRotateAt: status.nextRotateAt,
  };
}

/** Directly overwrites the live ("current") or staged ("next") shop slate. Every key must exist and be active. */
export async function adminSetShopSlate(target: 'current' | 'next', itemKeys: string[]): Promise<void> {
  const unique = Array.from(new Set(itemKeys));
  const items = await getItemsByKeys(unique);
  if (items.length !== unique.length) throw new Error('UNKNOWN_ITEM');
  if (items.some(i => !i.active)) throw new Error('ITEM_NOT_ACTIVE');
  const column = target === 'current' ? 'item_keys' : 'next_item_keys';
  await query(`INSERT INTO brawl_item_shop_state (id, ${column}) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET ${column}=$1`, [unique]);
}

/** Re-rolls the staged "next" queue at random from the currently-active catalog. */
export async function adminRegenerateNextShop(): Promise<string[]> {
  const allItems = await listAllItems();
  const keys = pickShopItems(allItems.map(toDef));
  await query('INSERT INTO brawl_item_shop_state (id, next_item_keys) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET next_item_keys=$1', [keys]);
  return keys;
}

/** Force-promotes the staged "next" queue into the live shop immediately, without waiting for the 24h timer. */
export async function adminRotateShopNow(): Promise<void> {
  return transaction(async client => {
    const row = (await client.query('SELECT * FROM brawl_item_shop_state WHERE id=1 FOR UPDATE')).rows[0] as ShopStateRow | undefined;
    const allItems = await listAllItems();
    const promoted = row?.next_item_keys?.length ? row.next_item_keys : pickShopItems(allItems.map(toDef));
    const freshNext = pickShopItems(allItems.map(toDef));
    await client.query(
      'INSERT INTO brawl_item_shop_state (id, item_keys, next_item_keys, rotated_at) VALUES (1, $1, $2, now()) ON CONFLICT (id) DO UPDATE SET item_keys=$1, next_item_keys=$2, rotated_at=now()',
      [promoted, freshNext],
    );
  });
}
