// Single source of truth for Poke Brawl Items, mirroring tiers.ts. The full
// catalog exists here (including items with no in-game use yet), but only
// items with enabledInShop: true are eligible to appear in the rotating
// shop -- for now that's just the 10 evolution stones. Held/trade evolution
// items (Razor Claw, Oval Stone, Metal Coat, King's Rock, Dragon Scale,
// Up-Grade) are defined so the catalog/shop machinery already understands
// them, but stay out of rotation until there's an actual way to use them.

export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'stone' | 'held';

export interface BrawlItemDef {
  key: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  kind: ItemKind;
  price: number;
  spriteUrl: string;
  enabledInShop: boolean;
}

// Same sprite CDN importPokeBrawlSpecies.ts already pulls Pokemon art from
// (PokeAPI's sprites live at raw.githubusercontent.com/PokeAPI/sprites).
const ITEM_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const sprite = (key: string) => `${ITEM_SPRITE_BASE}/${key}.png`;

export const BRAWL_ITEMS: BrawlItemDef[] = [
  // Evolution stones -- the only items live in the shop right now. Rarity
  // split (5 common / 3 uncommon / 2 rare) exactly matches SHOP_RARITY_QUOTAS
  // below, so today all 10 always fill the shop; once more items get
  // enabled in a tier, real rotation kicks in automatically.
  { key: 'fire-stone', name: 'Fire Stone', description: 'Evolves certain Pokemon, such as Vulpix and Growlithe, when used.', rarity: 'common', kind: 'stone', price: 800, spriteUrl: sprite('fire-stone'), enabledInShop: true },
  { key: 'water-stone', name: 'Water Stone', description: 'Evolves certain Pokemon, such as Poliwhirl and Shellder, when used.', rarity: 'common', kind: 'stone', price: 800, spriteUrl: sprite('water-stone'), enabledInShop: true },
  { key: 'thunder-stone', name: 'Thunder Stone', description: 'Evolves certain Pokemon, such as Pikachu and Eevee, when used.', rarity: 'common', kind: 'stone', price: 800, spriteUrl: sprite('thunder-stone'), enabledInShop: true },
  { key: 'leaf-stone', name: 'Leaf Stone', description: 'Evolves certain Pokemon, such as Gloom and Weepinbell, when used.', rarity: 'common', kind: 'stone', price: 800, spriteUrl: sprite('leaf-stone'), enabledInShop: true },
  { key: 'moon-stone', name: 'Moon Stone', description: 'Evolves certain Pokemon, such as Clefairy and Jigglypuff, when used.', rarity: 'common', kind: 'stone', price: 800, spriteUrl: sprite('moon-stone'), enabledInShop: true },
  { key: 'sun-stone', name: 'Sun Stone', description: 'Evolves certain Pokemon, such as Gloom and Sunkern, when used.', rarity: 'uncommon', kind: 'stone', price: 1800, spriteUrl: sprite('sun-stone'), enabledInShop: true },
  { key: 'shiny-stone', name: 'Shiny Stone', description: 'Evolves certain Pokemon, such as Togetic and Roselia, when used.', rarity: 'uncommon', kind: 'stone', price: 1800, spriteUrl: sprite('shiny-stone'), enabledInShop: true },
  { key: 'dusk-stone', name: 'Dusk Stone', description: 'Evolves certain Pokemon, such as Murkrow and Misdreavus, when used.', rarity: 'uncommon', kind: 'stone', price: 1800, spriteUrl: sprite('dusk-stone'), enabledInShop: true },
  { key: 'dawn-stone', name: 'Dawn Stone', description: 'Evolves certain gender-specific Pokemon, such as Kirlia and Snorunt, when used.', rarity: 'rare', kind: 'stone', price: 3500, spriteUrl: sprite('dawn-stone'), enabledInShop: true },
  { key: 'ice-stone', name: 'Ice Stone', description: 'Evolves certain Pokemon, such as Alolan Vulpix and Eevee, when used.', rarity: 'rare', kind: 'stone', price: 3500, spriteUrl: sprite('ice-stone'), enabledInShop: true },

  // Held/trade evolution items -- catalogued for later, not purchasable yet.
  { key: 'oval-stone', name: 'Oval Stone', description: 'Held by Happiny, evolves it into Chansey when leveled up during the day.', rarity: 'uncommon', kind: 'held', price: 2000, spriteUrl: sprite('oval-stone'), enabledInShop: false },
  { key: 'dragon-scale', name: 'Dragon Scale', description: 'Held by Seadra, evolves it into Kingdra when traded.', rarity: 'uncommon', kind: 'held', price: 2000, spriteUrl: sprite('dragon-scale'), enabledInShop: false },
  { key: 'up-grade', name: 'Up-Grade', description: 'Held by Porygon, evolves it into Porygon2 when traded.', rarity: 'uncommon', kind: 'held', price: 2000, spriteUrl: sprite('up-grade'), enabledInShop: false },
  { key: 'metal-coat', name: 'Metal Coat', description: 'Held by Onix or Scyther, evolves them into Steelix or Scizor when traded.', rarity: 'rare', kind: 'held', price: 4000, spriteUrl: sprite('metal-coat'), enabledInShop: false },
  { key: 'kings-rock', name: "King's Rock", description: 'Held by Poliwhirl or Slowpoke, evolves them into Politoed or Slowking when traded.', rarity: 'rare', kind: 'held', price: 4000, spriteUrl: sprite('kings-rock'), enabledInShop: false },
  { key: 'razor-claw', name: 'Razor Claw', description: 'Held by Sneasel, evolves it into Weavile when leveled up at night.', rarity: 'rare', kind: 'held', price: 4000, spriteUrl: sprite('razor-claw'), enabledInShop: false },
];

export const ITEM_MAP: Record<string, BrawlItemDef> = Object.fromEntries(BRAWL_ITEMS.map(i => [i.key, i]));

export const SHOP_ROTATION_MS = 24 * 60 * 60 * 1000;
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
 * Picks the day's shop stock: up to the rarity quota from each tier's
 * currently-enabled pool (fewer if a tier doesn't have enough enabled items
 * yet). Shared/global -- every player sees the same 10 items until the next
 * 24h rotation.
 */
export function pickShopItems(): string[] {
  const keys: string[] = [];
  for (const rarity of Object.keys(SHOP_RARITY_QUOTAS) as ItemRarity[]) {
    const pool = BRAWL_ITEMS.filter(i => i.enabledInShop && i.rarity === rarity);
    keys.push(...shuffled(pool).slice(0, SHOP_RARITY_QUOTAS[rarity]).map(i => i.key));
  }
  return keys;
}
