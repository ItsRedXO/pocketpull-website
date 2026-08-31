import { OpenedCard } from './types';

export const AI_NAMES = ['Jack', 'Dale', 'Emily'];

/** Probability a bot wins any mixed human-vs-bot battle (51.02%). */
export const BOT_WIN_CHANCE = 0.5102;
/** Threshold equivalent: roll < BOT_WIN_CHANCE * 100 → bot wins. */
export const BOT_WIN_ROLL_THRESHOLD = BOT_WIN_CHANCE * 100; // 51.02

export const RARITY_EMOJIS: Record<string, string> = {
  common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
};

/**
 * Roll the bot edge dice deterministically.
 *
 * Only used in Underdog mode.  Accepts a pre-computed provably fair roll
 * (0.0000–99.9999) so the dice toss is auditable — same HMAC-SHA256
 * pipeline as every battle pack pull.
 *
 * Returns which faction to force-win.
 * Returns null for shared mode or when all players are same type.
 */
export function rollBotWinChance(
  results: any[],
  mode: string,
  roll: number,
): 'bot' | 'human' | null {
  if (mode === 'shared') return null;
  const hasBots = results.some(r => r.isAi);
  const hasHumans = results.some(r => !r.isAi);
  if (!hasBots || !hasHumans) return null;
  return roll < BOT_WIN_ROLL_THRESHOLD ? 'bot' : 'human';
}

/**
 * Build the candidate pool for winner selection (same logic as
 * determineBattleWinner so tie detection is consistent).
 */
export function getWinnerPool(
  results: any[],
  forcedFaction: 'bot' | 'human' | null,
) {
  const pool = forcedFaction === 'bot'
    ? results.filter(r => r.isAi)
    : forcedFaction === 'human'
      ? results.filter(r => !r.isAi)
      : results;
  return pool;
}

/**
 * Detect exact value ties in Standard / Underdog battles.
 *
 * A tie exists when 2+ players in the candidate pool share the same
 * winning total.  This means `determineBattleWinner` alone cannot
 * fairly pick a winner — the reduce() picks the first match but the
 * other player(s) had equal claim.
 */
export function isExactTie(pool: any[], mode: string): boolean {
  if (pool.length < 2) return false;

  // Values come from SQLite/JSON and can arrive as strings or have tiny
  // floating-point differences. Battles are settled to cents, so compare
  // normalized cent values rather than raw JS values.
  const totals = pool.map(player => Math.round(Number(player.totalValue || 0) * 100));
  const target = mode === 'underdog' ? Math.min(...totals) : Math.max(...totals);
  return totals.filter(total => total === target).length >= 2 && totals.every(total => total === target);
}

/**
 * Determine the battle winner.
 *
 * Standard mode (forcedFaction = null): highest totalValue wins. Pure, no bias.
 * Underdog mode: lowest totalValue wins (within forced faction if set).
 * Shared mode: everyone wins (returns first player).
 *
 * If forcedFaction is set (Underdog bot edge), the winner is picked ONLY
 * from that faction. Values are never modified — displayed totals always
 * reflect actual card values.
 *
 * IMPORTANT: Callers MUST check isExactTie() first.  If a tie exists,
 * this function returns an arbitrary result from the tied group — do
 * not use it to decide card transfer.
 */
export function determineBattleWinner(
  results: any[],
  mode: string,
  forcedFaction: 'bot' | 'human' | null,
) {
  const pool = getWinnerPool(results, forcedFaction);

  if (pool.length === 0) return results[0];

  if (mode === 'underdog') {
    return pool.reduce(
      (lowest, r) => Number(r.totalValue || 0) < Number(lowest.totalValue || 0) ? r : lowest,
      pool[0],
    );
  }
  // standard (or anything else): highest wins
  return pool.reduce(
    (highest, r) => Number(r.totalValue || 0) > Number(highest.totalValue || 0) ? r : highest,
    pool[0],
  );
}

/**
 * Distribute cards evenly across players (shared mode).
 *
 * **Hard constraint**: every player must end with exactly the same number
 * of cards they opened.  Value balance is optimized within that constraint.
 *
 * Two-phase deterministic algorithm:
 *   1. Constrained greedy: sort cards by value descending, assign each to
 *      the eligible (still-under-capacity) player with the lowest running
 *      total.  This guarantees equal counts.
 *   2. Hill-climbing swaps: iteratively try all pairwise card swaps; apply
 *      any swap that strictly reduces the global max deviation from the
 *      equal-share value target.  Converges to a local optimum.
 *
 * Deterministic → provably fair reproducible verification.
 *
 * @param players — each entry's `.cards` are the cards that player
 *                  originally pulled (all same length).
 * @returns map of playerId → assigned cards (every bucket has the same
 *          cardinality).
 */
export function distributeCardsShared(
  players: { playerId: string; cards: OpenedCard[] }[],
): Map<string, OpenedCard[]> {
  const playerCount = players.length;
  if (playerCount < 2) {
    // Single-player edge case: just return their cards unchanged.
    const m = new Map<string, OpenedCard[]>();
    for (const p of players) m.set(p.playerId, [...p.cards]);
    return m;
  }

  const allCards: OpenedCard[] = players.flatMap(p => p.cards);
  const cardsPerPlayer = allCards.length / playerCount;

  if (!Number.isInteger(cardsPerPlayer)) {
    throw new Error(
      `[distributeCardsShared] Total cards (${allCards.length}) ` +
      `not evenly divisible by ${playerCount} players`
    );
  }

  const targetValue =
    allCards.reduce((sum, c) => sum + c.value, 0) / playerCount;

  // ── Phase 1: Constrained greedy assignment ────────────────────────
  const buckets = new Map<string, OpenedCard[]>();
  const totals = new Map<string, number>();
  const caps = new Map<string, number>();

  for (const p of players) {
    buckets.set(p.playerId, []);
    totals.set(p.playerId, 0);
    caps.set(p.playerId, cardsPerPlayer);
  }

  // Sort highest value first so big cards rotate across eligible players
  const sorted = [...allCards].sort((a, b) => b.value - a.value);

  for (const card of sorted) {
    // Find eligible player (under capacity) with lowest current total
    let bestId = '';
    let bestTotal = Infinity;
    for (const p of players) {
      if ((caps.get(p.playerId) ?? 0) <= 0) continue;
      const t = totals.get(p.playerId) ?? 0;
      if (t < bestTotal) {
        bestTotal = t;
        bestId = p.playerId;
      }
    }
    // bestId is guaranteed to be set because total cards = total capacity
    buckets.get(bestId)!.push(card);
    totals.set(bestId, bestTotal + card.value);
    caps.set(bestId, (caps.get(bestId) ?? 0) - 1);
  }

  // ── Phase 2: Hill-climbing pair-wise swap optimisation ────────────
  const attemptSwap = (): boolean => {
    // Recompute current totals and max deviation
    for (const p of players) {
      totals.set(
        p.playerId,
        buckets.get(p.playerId)!.reduce((s, c) => s + c.value, 0),
      );
    }

    let currentMaxDev = 0;
    for (const p of players) {
      const d = Math.abs((totals.get(p.playerId) ?? 0) - targetValue);
      if (d > currentMaxDev) currentMaxDev = d;
    }

    // Try every unordered pair of players
    for (let i = 0; i < playerCount; i++) {
      for (let j = i + 1; j < playerCount; j++) {
        const pidA = players[i].playerId;
        const pidB = players[j].playerId;
        const bucketA = buckets.get(pidA)!;
        const bucketB = buckets.get(pidB)!;
        const totalA = totals.get(pidA)!;
        const totalB = totals.get(pidB)!;

        for (let ai = 0; ai < bucketA.length; ai++) {
          for (let bi = 0; bi < bucketB.length; bi++) {
            const cardA = bucketA[ai];
            const cardB = bucketB[bi];

            const newTotalA = totalA - cardA.value + cardB.value;
            const newTotalB = totalB - cardB.value + cardA.value;

            // Compute new max deviation across ALL players
            let newMaxDev = Math.abs(newTotalA - targetValue);
            newMaxDev = Math.max(newMaxDev, Math.abs(newTotalB - targetValue));
            for (const p of players) {
              if (p.playerId === pidA || p.playerId === pidB) continue;
              newMaxDev = Math.max(
                newMaxDev,
                Math.abs((totals.get(p.playerId) ?? 0) - targetValue),
              );
            }

            if (newMaxDev < currentMaxDev - 0.0001) {
              // Apply the swap
              bucketA[ai] = cardB;
              bucketB[bi] = cardA;
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  let iterations = 0;
  const MAX_ITERATIONS = 5000;
  while (attemptSwap() && iterations < MAX_ITERATIONS) {
    iterations++;
  }

  return buckets;
}
