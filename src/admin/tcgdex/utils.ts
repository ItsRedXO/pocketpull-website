import { TcgDexCard } from '../../lib/tcgdex';
import { MappedRarity } from './types';

export const RARITY_MAP: Record<string, string> = {
  'common': 'common', 'uncommon': 'uncommon', 'rare': 'rare', 'rare holo': 'rare', 'holo rare': 'rare',
  'rare holo vstar': 'ultra', 'rare holo vmax': 'ultra', 'rare holo v': 'ultra', 'rare ultra': 'ultra',
  'ultra rare': 'ultra', 'holo rare v': 'ultra', 'holo rare vmax': 'ultra', 'double rare': 'ultra',
  'secret rare': 'secret', 'hyper rare': 'secret', 'rainbow rare': 'secret', 'illustration rare': 'rare',
  'special illustration rare': 'secret', 'amazing rare': 'ultra', 'shiny rare': 'secret',
  'shiny ultra rare': 'secret', 'trainer gallery holo rare': 'rare', 'promo': 'rare',
  'rare holo ex': 'ultra', 'rare holo gx': 'ultra', 'classic collection': 'ultra',
  'ace spec rare': 'secret', 'tera': 'ultra',
};

export function mapRarity(raw: string | null): MappedRarity {
  if (!raw) return 'common';
  const lower = raw.toLowerCase().trim();
  return (RARITY_MAP[lower] as MappedRarity) ?? 'common';
}

export const RARITY_COLORS: Record<MappedRarity, string> = {
  common: '#8892a4', 
  uncommon: '#10b981', 
  rare: '#00c8ff', 
  ultra: '#9b5cff', 
  secret: '#ffd700', 
  god: '#ff00ff',
};

export function getBestPrice(card: TcgDexCard): number | null {
  if (!card) return null;
  if (card.tcgplayerPrice !== null && card.tcgplayerPrice > 0) return card.tcgplayerPrice;
  if (card.cardmarketPrice !== null && card.cardmarketPrice > 0) return card.cardmarketPrice;
  return null;
}

export function formatPrice(card: TcgDexCard): { display: string; hasPrice: boolean; currency: string } {
  if (!card) return { display: 'N/A', hasPrice: false, currency: '' };
  if (card.tcgplayerPrice !== null && card.tcgplayerPrice > 0) return { display: `$${card.tcgplayerPrice.toFixed(2)}`, hasPrice: true, currency: 'USD' };
  if (card.cardmarketPrice !== null && card.cardmarketPrice > 0) return { display: `€${card.cardmarketPrice.toFixed(2)}`, hasPrice: true, currency: 'EUR' };
  return { display: 'Price unavailable', hasPrice: false, currency: '' };
}

export function estimateValue(card: TcgDexCard): number {
  if (!card) return 0.50;
  const best = getBestPrice(card);
  if (best !== null) return best;
  const rarity = mapRarity(card.rarity);
  const defaults: Record<string, number> = { common: 0.15, uncommon: 0.35, rare: 1.50, ultra: 5.00, secret: 20.00, god: 80.00 };
  return defaults[rarity] ?? 0.50;
}
