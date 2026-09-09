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
