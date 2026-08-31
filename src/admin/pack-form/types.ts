export const RARITIES = ['common', 'uncommon', 'rare', 'ultra', 'secret', 'god'] as const;
export const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};

export type Rarity = typeof RARITIES[number];

export interface CardDraft {
  id: string;
  cardName: string;
  rarity: Rarity;
  pullChance: string;
  estimatedValue: string;
  cardImageUrl: string;
  sortOrder: number;
  quantity: string;
  originalQuantity?: number;
}

export type PackType = 'standard' | 'mystery';

export interface PackDraft {
  packType: PackType;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  glowColor: string;
  borderColor: string;
  isActive: boolean;
  sortOrder: string;
  quantityLimit: string;
  cooldownHours: string;
  expiresAt: string;
  nameColor: string;
  descriptionColor: string;
  priceColor: string;
  buttonTextColor: string;
  openAnotherButtonTextColor: string;
}
