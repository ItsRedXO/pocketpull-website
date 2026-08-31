import { startOfDay } from 'date-fns';

/**
 * Deterministic pseudo-random number generator using a seed.
 */
export function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }

  return function() {
    h = Math.imul(h ^ h >>> 16, 0x85ebca6b);
    h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const ADJECTIVES = ['Epic', 'Rare', 'Lucky', 'Shiny', 'Super', 'Hyper', 'Ultra', 'Giga', 'Mega', 'Shadow', 'Neon', 'Golden', 'Silver', 'Mystic', 'Master', 'Poke', 'Trainer', 'Elite', 'Ancient', 'Primal'];
const NOUNS = ['Puller', 'Hunter', 'Collector', 'King', 'Queen', 'Master', 'Expert', 'Player', 'Gamer', 'Dragon', 'Phoenix', 'Beast', 'Legend', 'Lord', 'Knight', 'Pikachu', 'Charizard', 'Mew', 'Ace', 'Champ'];

export function generateUsername(seed: string) {
  const rng = seededRandom(seed);
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
  const num = Math.floor(rng() * 999);
  return `${adj}${noun}${num}`;
}

export function getDailySeed() {
  // Use PST (UTC-8) for daily cycle
  const now = new Date();
  const pstOffset = 8 * 60 * 60 * 1000;
  const pstDate = new Date(now.getTime() - pstOffset);
  return startOfDay(pstDate).toISOString();
}

/**
 * Returns a value that increases slowly throughout the day.
 * @param base Base value at start of day
 * @param perDay Total expected increase in 24h
 */
export function getDailyIncrementalValue(base: number, perDay: number) {
  const start = startOfDay(new Date()).getTime();
  const elapsedMs = Date.now() - start;
  const msPerUnit = (86400 * 1000) / perDay;
  return base + Math.floor(elapsedMs / msPerUnit);
}
