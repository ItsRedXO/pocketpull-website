// Item Shop constants/logic. The catalog itself lives in the brawl_items
// table (admin-editable -- see repositories/brawlItems.ts) rather than here;
// this file only holds the shape of an item and the pure selection logic
// that doesn't need to know where the catalog came from.

export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'stone' | 'held' | 'other';

export interface BrawlItemDef {
  key: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  kind: ItemKind;
  price: number;
  spriteUrl: string | null;
  active: boolean;
}

export const SHOP_RARITY_QUOTAS: Record<ItemRarity, number> = { common: 5, uncommon: 3, rare: 2 };

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks a shop's stock from `pool`: up to the rarity quota from each tier's
 * active items (fewer if a tier doesn't have enough active items). Pure and
 * pool-driven so both the live rotation and admin's "regenerate next" button
 * can reuse it against whatever the catalog currently looks like.
 */
export function pickShopItems(pool: BrawlItemDef[]): string[] {
  const keys: string[] = [];
  for (const rarity of Object.keys(SHOP_RARITY_QUOTAS) as ItemRarity[]) {
    const tierPool = pool.filter(i => i.active && i.rarity === rarity);
    keys.push(...shuffled(tierPool).slice(0, SHOP_RARITY_QUOTAS[rarity]).map(i => i.key));
  }
  return keys;
}
