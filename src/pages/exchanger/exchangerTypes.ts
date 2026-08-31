// ─── Exchanger Types ───────────────────────────────────────────────────────

export interface InventoryCard {
  id: string;
  cardId: string;
  cardName: string;
  rarity: string;
  value: number;
  emoji: string;
  isFavorite: boolean;
  isLocked: boolean;
  createdAt: string;
  cardImageUrl?: string | null;
}

export interface MarketCard {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  category: string;
  imageUrl?: string | null;
  packName?: string;
}

export type SortOption = 'highest' | 'lowest' | 'newest' | 'rarity' | 'alpha';

export const RARITY_COLORS: Record<string, string> = {
  common:    '#8892a4',
  uncommon:  '#10b981',
  rare:      '#00c8ff',
  holo:      '#38bdf8',
  'reverse holo': '#7dd3fc',
  ultra:     '#9b5cff',
  secret:    '#ffd700',
  god:       '#ff00ff',
};

export const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, holo: 3,
  'reverse holo': 3, ultra: 4, secret: 5, god: 6,
};

export const CATEGORIES = [
  'All', 'Common', 'Uncommon', 'Rare', 'Ultra', 'Secret', 'God',
];
