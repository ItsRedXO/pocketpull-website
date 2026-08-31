// ── Constants ──────────────────────────────────────────────────────────────────

// chance = (1 / multiplier) * 100 * 0.88 (12% house edge)
// This reflects the base odds when the target card is exactly at the multiplier threshold.
// The actual displayed odds recalculate dynamically based on the real target card value selected.
export const MULTIPLIERS = [
  { label: '1.2x', value: 1.2 },
  { label: '1.5x', value: 1.5 },
  { label: '2x',   value: 2 },
  { label: '5x',   value: 5 },
  { label: '10x',  value: 10 },
];

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'ultra', 'secret', 'god'];

export const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  ultra: '#a78bfa',
  secret: '#fbbf24',
  god: '#f43f5e',
};

export const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra: 'Ultra Rare',
  secret: 'Secret Rare',
  god: 'GOD',
};

// All possible cards in the game (pool for target selection)
export const ALL_CARDS_POOL = [
  { cardId: 'charizard_vmax_secret', name: 'Charizard VMAX', emoji: '🔥', rarity: 'secret', value: 320 },
  { cardId: 'pikachu_illustrator_secret', name: 'Pikachu Illustrator', emoji: '⚡', rarity: 'secret', value: 280 },
  { cardId: 'eternatus_vmax_secret', name: 'Eternatus VMAX', emoji: '👾', rarity: 'secret', value: 265 },
  { cardId: 'umbreon_vmax_ultra', name: 'Umbreon VMAX', emoji: '🌙', rarity: 'ultra', value: 145 },
  { cardId: 'gengar_vmax_alt_ultra', name: 'Gengar VMAX Alt', emoji: '👻', rarity: 'ultra', value: 178 },
  { cardId: 'darkrai_vstar_ultra', name: 'Darkrai VSTAR', emoji: '🌑', rarity: 'ultra', value: 120 },
  { cardId: 'pikachu_v_alt_ultra', name: 'Pikachu V Alt Art', emoji: '⚡', rarity: 'ultra', value: 89 },
  { cardId: 'eevee_v_alt_rare', name: 'Eevee V Alt Art', emoji: '🦊', rarity: 'rare', value: 65 },
  { cardId: 'blastoise_vmax_rare', name: 'Blastoise VMAX', emoji: '💧', rarity: 'rare', value: 78 },
  { cardId: 'mewtwo_v_union_rare', name: 'Mewtwo V-Union', emoji: '🧬', rarity: 'rare', value: 95 },
  { cardId: 'bulbasaur_v_uncommon', name: 'Bulbasaur V', emoji: '🌿', rarity: 'uncommon', value: 18 },
  { cardId: 'squirtle_v_uncommon', name: 'Squirtle V', emoji: '💦', rarity: 'uncommon', value: 15 },
  { cardId: 'charmander_v_uncommon', name: 'Charmander V', emoji: '🔥', rarity: 'uncommon', value: 22 },
  { cardId: 'rattata_common', name: 'Rattata', emoji: '🐭', rarity: 'common', value: 2 },
  { cardId: 'pidgey_common', name: 'Pidgey', emoji: '🐦', rarity: 'common', value: 1.5 },
  { cardId: 'caterpie_common', name: 'Caterpie', emoji: '🐛', rarity: 'common', value: 1 },
  { cardId: 'mew_vmax_god', name: 'Mew VMAX Alt Art', emoji: '🌈', rarity: 'god', value: 310 },
  { cardId: 'lugia_v_alt_god', name: 'Lugia V Alt Art', emoji: '🕊️', rarity: 'god', value: 310 },
  { cardId: 'cosmog_vmax_god', name: 'Cosmog VMAX Rainbow', emoji: '🌌', rarity: 'god', value: 290 },
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InventoryRow {
  id: string;
  cardId: string;
  cardName: string;
  rarity: string;
  value: number;
  emoji: string;
  isFavorite: boolean;
  cardImageUrl?: string | null;
}

export interface TargetCard {
  cardId: string;
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  cardImageUrl?: string | null;
}

// ── Utility: Generate unique ID ────────────────────────────────────────────────
export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
