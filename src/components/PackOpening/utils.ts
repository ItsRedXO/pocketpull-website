import { CardResult, Pack, FALLBACK_CARDS } from './types';

export function pickCardFromDB(
  dbCards: Array<{ cardName: string; rarity: string; pullChance: number; estimatedValue: number; cardImageUrl?: string }>,
  _packOdds?: Record<string, number>
): CardResult {
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selected = dbCards[dbCards.length - 1];
  for (const card of dbCards) {
    cumulative += card.pullChance;
    if (rand <= cumulative) {
      selected = card;
      break;
    }
  }
  const rarityEmojis: Record<string, string> = {
    common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
  };
  return {
    name: selected.cardName,
    emoji: rarityEmojis[selected.rarity] || '🃏',
    rarity: selected.rarity,
    value: selected.estimatedValue,
    imageUrl: selected.cardImageUrl,
  };
}

export function pickCardFromFallback(pack: Pack): CardResult {
  const odds = pack.odds || { common: 60, uncommon: 25, rare: 10, ultra: 4, secret: 1 };
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity = 'common';
  for (const [rarity, chance] of Object.entries(odds)) {
    cumulative += chance;
    if (rand <= cumulative) { selectedRarity = rarity; break; }
  }
  const pool = FALLBACK_CARDS[selectedRarity] || FALLBACK_CARDS.common;
  const card = pool[Math.floor(Math.random() * pool.length)];
  return { ...card, rarity: selectedRarity };
}
