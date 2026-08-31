export interface Pack {
  id: string;
  name: string;
  price: number;
  emoji?: string;
  rarity?: string;
  color?: string;
  glowColor?: string;
  odds?: Record<string, number>;
  imageUrl?: string;
  quantityLimit?: number;
  currentQuantity?: number;
  cooldownHours?: number;
  expiresAt?: string | null;
  buttonTextColor?: string;
  openAnotherButtonTextColor?: string;
}

export interface CardResult {
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  imageUrl?: string;
}

export type Stage = 'idle' | 'opening' | 'reveal' | 'done';

export const RARITY_COLORS: Record<string, string> = {
  common: '#8892a4',
  uncommon: '#10b981',
  rare: '#00c8ff',
  ultra: '#9b5cff',
  secret: '#ffd700',
  god: '#ff00ff',
  rainbow: '#ff0060',
};

export const FALLBACK_CARDS: Record<string, Array<{ name: string; emoji: string; value: number }>> = {
  secret: [
    { name: 'Charizard VMAX', emoji: '🔥', value: 320 },
    { name: 'Pikachu Illustrator', emoji: '⚡', value: 280 },
  ],
  ultra: [
    { name: 'Umbreon VMAX', emoji: '🌙', value: 145 },
    { name: 'Gengar VMAX Alt', emoji: '👻', value: 178 },
  ],
  rare: [
    { name: 'Eevee V Alt Art', emoji: '🦊', value: 65 },
    { name: 'Blastoise VMAX', emoji: '💧', value: 78 },
  ],
  uncommon: [
    { name: 'Bulbasaur V', emoji: '🌿', value: 18 },
    { name: 'Squirtle V', emoji: '💦', value: 15 },
  ],
  common: [
    { name: 'Rattata', emoji: '🐭', value: 2 },
    { name: 'Pidgey', emoji: '🐦', value: 1.5 },
  ],
  god: [
    { name: 'Mew VMAX Alt Art', emoji: '🌈', value: 310 },
    { name: 'Lugia V Alt Art', emoji: '🕊️', value: 310 },
  ],
};
