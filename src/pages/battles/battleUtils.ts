// ─── Battle Utilities ──────────────────────────────────────────────────────
import type { OpenedCard, BattleMode, PlayerBattleResult } from './battleTypes';
import { blink } from '../../lib/blink';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generatePrivateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function openPackCards(pack: any, dbCards: any[]): OpenedCard[] {
  const cards: OpenedCard[] = [];
  
  if (dbCards.length > 0) {
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selected = dbCards[dbCards.length - 1];
    for (const card of dbCards) {
      cumulative += Number(card.pullChance);
      if (rand <= cumulative) {
        selected = card;
        break;
      }
    }
    
    cards.push({
      id: uid(),
      name: selected.cardName,
      emoji: '🃏',
      rarity: selected.rarity,
      value: Number(selected.estimatedValue),
      packId: pack.id,
      packName: pack.name,
      imageUrl: selected.cardImageUrl,
    });
  } else {
    // Extreme fallback if no cards in DB for this pack
    cards.push({
      id: uid(),
      name: 'Mystery Card',
      emoji: '❓',
      rarity: 'common',
      value: 1.00,
      packId: pack.id,
      packName: pack.name,
    });
  }

  return cards;
}

export function determineBattleWinner(
  results: PlayerBattleResult[],
  mode: BattleMode
): PlayerBattleResult {
  if (mode === 'standard') {
    return results.reduce((best, p) => p.totalValue > best.totalValue ? p : best, results[0]);
  }
  if (mode === 'underdog') {
    return results.reduce((best, p) => p.totalValue < best.totalValue ? p : best, results[0]);
  }
  // shared — no single winner; return first for reference
  return results[0];
}

export async function awardCards(userId: string, cards: OpenedCard[]) {
  for (const card of cards) {
    try {
      const invId = uid();
      const newCard = {
        id: invId,
        userId,
        cardId: card.id,
        cardName: card.name,
        rarity: card.rarity,
        value: card.value,
        emoji: card.emoji,
        isFavorite: 0,
        cardImageUrl: card.imageUrl || null,
      };
      await blink.db.inventory.create(newCard as any);
    } catch (e) {
      console.warn('Failed to award card:', e);
    }
  }
}

export const RARITY_COLORS: Record<string, string> = {
  common: '#8892a4',
  uncommon: '#10b981',
  rare: '#00c8ff',
  ultra: '#9b5cff',
  secret: '#ffd700',
  god: '#ff00ff',
};

export const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(136,146,164,0.3)',
  uncommon: 'rgba(16,185,129,0.4)',
  rare: 'rgba(0,200,255,0.4)',
  ultra: 'rgba(155,92,255,0.5)',
  secret: 'rgba(255,215,0,0.5)',
  god: 'rgba(255,0,255,0.6)',
};

export const MODE_INFO: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  standard: { label: 'Standard', icon: '⚔️', desc: 'Highest total value wins all cards.', color: '#00c8ff' },
  underdog: { label: 'Underdog', icon: '🔄', desc: 'Lowest total value wins all cards.', color: '#9b5cff' },
  shared: { label: 'Shared', icon: '🤝', desc: 'All players split rewards evenly.', color: '#10b981' },
};
