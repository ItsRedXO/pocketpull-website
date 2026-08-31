export const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  ultra: '#a78bfa',
  secret: '#fbbf24',
  god: '#ff00ff',
  rainbow: '#f43f5e',
};

export interface RawCard {
  id: string;
  cardId: string;
  cardName: string;
  rarity: string;
  value: number;
  emoji: string;
  isFavorite: boolean | number;
  isLocked: boolean | number;
  createdAt: string;
  cardImageUrl?: string | null;
  packName?: string | null;
}

export interface InventoryCard extends RawCard {
  isFavorite: boolean;
  isLocked: boolean;
  value: number;
  quantity: number;
  allIds: string[];
}
