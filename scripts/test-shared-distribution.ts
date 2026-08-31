/**
 * Simulation script for the constrained distributeCardsShared algorithm.
 *
 * Tests 2 / 3 / 4-player shared battles with realistic card pools,
 * including the reported 4-player × 7-card Dragon pack case.
 *
 * Run: bun run --silent scripts/test-shared-distribution.ts
 */

// ── Deterministic PRNG for reproducibility ──────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Card pool generators ────────────────────────────────────────────

interface OpenedCard {
  id: string;
  name: string;
  rarity: string;
  value: number;
  imageUrl: string | null;
  packId: string;
  packName: string;
  emoji?: string;
}

/** Generate realistic Dragon-pack cards (7-card pack). */
function generateDragonPackCards(
  rng: () => number,
  playerIndex: number,
): OpenedCard[] {
  const packs = [
    {
      packId: 'dragon_trainer',
      packName: 'Dragon Trainer',
      cards: [
        { name: 'Rayquaza VMAX', rarity: 'god', baseValue: 200 },
        { name: 'Dragonite ex', rarity: 'secret', baseValue: 90 },
        { name: 'Salamence V', rarity: 'ultra', baseValue: 45 },
        { name: 'Garchomp', rarity: 'rare', baseValue: 12 },
        { name: 'Dragonair', rarity: 'uncommon', baseValue: 5 },
        { name: 'Dratini', rarity: 'uncommon', baseValue: 3 },
        { name: 'Dragon Energy', rarity: 'common', baseValue: 0.50 },
      ],
    },
  ];

  const result: OpenedCard[] = [];
  for (const pack of packs) {
    for (const card of pack.cards) {
      // Add some controlled variation per player to make it realistic
      const variance = 0.9 + rng() * 0.2; // ±10% value noise
      result.push({
        id: `sim_${playerIndex}_${card.name.replace(/\s+/g, '_')}`,
        name: card.name,
        rarity: card.rarity,
        value: Math.round(card.baseValue * variance * 100) / 100,
        imageUrl: `https://example.com/${card.name.toLowerCase().replace(/\s+/g, '_')}.png`,
        packId: pack.packId,
        packName: pack.packName,
        emoji: { god: '🌈', secret: '⭐', ultra: '🌙', rare: '💧', uncommon: '🌿', common: '🃏' }[card.rarity],
      });
    }
  }
  return result;
}

/** Generate mixed-value cards (used for diverse test cases). */
function generateMixedPackCards(
  rng: () => number,
  playerIndex: number,
  cardsPerPlayer: number,
): OpenedCard[] {
  const rarities = ['common', 'uncommon', 'rare', 'ultra', 'secret', 'god'];
  const result: OpenedCard[] = [];
  for (let i = 0; i < cardsPerPlayer; i++) {
    const rarityIdx = Math.floor(rng() * rarities.length);
    const rarity = rarities[rarityIdx];
    const baseValue =
      rarity === 'god' ? 100 + rng() * 200 :
      rarity === 'secret' ? 40 + rng() * 80 :
      rarity === 'ultra' ? 20 + rng() * 40 :
      rarity === 'rare' ? 5 + rng() * 20 :
      rarity === 'uncommon' ? 1 + rng() * 5 :
      0.01 + rng() * 1;
    result.push({
      id: `sim_${playerIndex}_${i}`,
      name: `Card ${rarity} #${i}`,
      rarity,
      value: Math.round(baseValue * 100) / 100,
      imageUrl: null,
      packId: 'test',
      packName: 'Test Pack',
      emoji: { god: '🌈', secret: '⭐', ultra: '🌙', rare: '💧', uncommon: '🌿', common: '🃏' }[rarity],
    });
  }
  return result;
}

// ── THE ALGORITHM UNDER TEST ────────────────────────────────────────
// (Mirrors backend/routes/battles/utils.ts exactly)

function distributeCardsShared(
  players: { playerId: string; cards: OpenedCard[] }[],
): Map<string, OpenedCard[]> {
  const playerCount = players.length;
  if (playerCount < 2) {
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

  const buckets = new Map<string, OpenedCard[]>();
  const totals = new Map<string, number>();
  const caps = new Map<string, number>();

  for (const p of players) {
    buckets.set(p.playerId, []);
    totals.set(p.playerId, 0);
    caps.set(p.playerId, cardsPerPlayer);
  }

  const sorted = [...allCards].sort((a, b) => b.value - a.value);

  for (const card of sorted) {
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
    buckets.get(bestId)!.push(card);
    totals.set(bestId, bestTotal + card.value);
    caps.set(bestId, (caps.get(bestId) ?? 0) - 1);
  }

  // Phase 2: Hill-climbing swaps
  const attemptSwap = (): boolean => {
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

// ── Test runner ─────────────────────────────────────────────────────

interface TestResult {
  playerCount: number;
  cardsPerPlayer: number;
  seed: number;
  passed: boolean;
  details: {
    playerId: string;
    cardCount: number;
    totalValue: number;
    deviation: number;
  }[];
  maxDeviation: number;
  targetValue: number;
  totalValue: number;
}

function runTest(
  playerCount: number,
  cardsPerPlayer: number,
  seed: number,
  useDragon: boolean,
): TestResult {
  const rng = mulberry32(seed);
  const players: { playerId: string; cards: OpenedCard[] }[] = [];

  for (let i = 0; i < playerCount; i++) {
    const cards = useDragon
      ? generateDragonPackCards(rng, i)
      : generateMixedPackCards(rng, i, cardsPerPlayer);
    players.push({ playerId: `player_${i + 1}`, cards });
  }

  const totalCards = players.reduce((s, p) => s + p.cards.length, 0);
  const totalValue = players.flatMap(p => p.cards).reduce((s, c) => s + c.value, 0);
  const targetValue = totalValue / playerCount;

  let distribution: Map<string, OpenedCard[]>;
  try {
    distribution = distributeCardsShared(players);
  } catch (err: any) {
    return {
      playerCount,
      cardsPerPlayer,
      seed,
      passed: false,
      details: [],
      maxDeviation: Infinity,
      targetValue: totalValue / playerCount,
      totalValue,
    };
  }

  let allPassed = true;
  const details: TestResult['details'] = [];

  for (const p of players) {
    const bucket = distribution.get(p.playerId) || [];
    const bucketValue = bucket.reduce((s, c) => s + c.value, 0);
    const deviation = bucketValue - targetValue;

    if (bucket.length !== cardsPerPlayer) {
      allPassed = false;
    }

    details.push({
      playerId: p.playerId,
      cardCount: bucket.length,
      totalValue: Math.round(bucketValue * 100) / 100,
      deviation: Math.round(deviation * 100) / 100,
    });
  }

  const maxDeviation = Math.max(...details.map(d => Math.abs(d.deviation)));

  return {
    playerCount,
    cardsPerPlayer,
    seed,
    passed: allPassed && details.every(d => d.cardCount === cardsPerPlayer),
    details,
    maxDeviation,
    targetValue: Math.round(targetValue * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
  };
}

// ── Main ────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════');
console.log('  Shared Distribution Algorithm Audit');
console.log('  Constrained equal-card-count + value balancing');
console.log('═══════════════════════════════════════════════════════\n');

const testCases: {
  label: string;
  playerCount: number;
  cardsPerPlayer: number;
  seed: number;
  dragon?: boolean;
}[] = [
  // Core reported case
  { label: '4P × 7 Dragon (reported issue)', playerCount: 4, cardsPerPlayer: 7, seed: 42, dragon: true },
  { label: '4P × 7 Dragon (seed 123)', playerCount: 4, cardsPerPlayer: 7, seed: 123, dragon: true },
  { label: '4P × 7 Dragon (seed 999)', playerCount: 4, cardsPerPlayer: 7, seed: 999, dragon: true },

  // 2-player tests
  { label: '2P × 3 cards', playerCount: 2, cardsPerPlayer: 3, seed: 10 },
  { label: '2P × 5 cards', playerCount: 2, cardsPerPlayer: 5, seed: 20 },
  { label: '2P × 7 cards', playerCount: 2, cardsPerPlayer: 7, seed: 30 },

  // 3-player tests
  { label: '3P × 3 cards', playerCount: 3, cardsPerPlayer: 3, seed: 40 },
  { label: '3P × 5 cards', playerCount: 3, cardsPerPlayer: 5, seed: 50 },
  { label: '3P × 7 cards', playerCount: 3, cardsPerPlayer: 7, seed: 60 },

  // 4-player tests
  { label: '4P × 3 cards', playerCount: 4, cardsPerPlayer: 3, seed: 70 },
  { label: '4P × 5 cards', playerCount: 4, cardsPerPlayer: 5, seed: 80 },
  { label: '4P × 7 cards (mixed)', playerCount: 4, cardsPerPlayer: 7, seed: 90 },

  // Edge cases
  { label: '2P × 1 card', playerCount: 2, cardsPerPlayer: 1, seed: 100 },
  { label: '4P × 1 card', playerCount: 4, cardsPerPlayer: 1, seed: 110 },
  { label: '3P × 10 cards', playerCount: 3, cardsPerPlayer: 10, seed: 120 },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = runTest(tc.playerCount, tc.cardsPerPlayer, tc.seed, tc.dragon ?? false);

  if (result.passed) {
    console.log(`✓ ${tc.label}`);
    console.log(`  Cards/player: ${result.details.map(d => d.cardCount).join('/')}`);
    console.log(`  Values: ${result.details.map(d => `$${d.totalValue.toFixed(2)}`).join(' | ')}`);
    console.log(`  Max deviation: $${result.maxDeviation.toFixed(2)}  (target: $${result.targetValue.toFixed(2)}, pool: $${result.totalValue.toFixed(2)})`);
    passed++;
  } else {
    console.log(`✗ ${tc.label} — FAILED`);
    console.log(`  Cards/player: ${result.details.map(d => d.cardCount).join('/')}`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed out of ${testCases.length}`);
console.log('═══════════════════════════════════════════════════════');

// ── Stress test: 100 random 4P×7 runs ───────────────────────────────
console.log('\n--- Stress test: 100 random 4P×7 Dragon simulations ---');
let stressPassed = 0;
let stressMaxDev = 0;
let stressTotalDev = 0;

for (let seed = 1000; seed < 1100; seed++) {
  const result = runTest(4, 7, seed, true);
  if (result.passed) stressPassed++;
  stressMaxDev = Math.max(stressMaxDev, result.maxDeviation);
  stressTotalDev += result.maxDeviation;
}

console.log(`  Passed: ${stressPassed}/100`);
console.log(`  Max deviation: $${stressMaxDev.toFixed(2)}`);
console.log(`  Avg deviation: $${(stressTotalDev / 100).toFixed(2)}`);

process.exit(failed > 0 ? 1 : 0);
