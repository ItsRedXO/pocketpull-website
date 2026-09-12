import { startOfDayInZone } from './dailyReset';

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

const ADJECTIVES = [
  'Epic', 'Rare', 'Lucky', 'Shiny', 'Super', 'Hyper', 'Ultra', 'Giga', 'Mega', 'Shadow',
  'Neon', 'Golden', 'Silver', 'Mystic', 'Master', 'Poke', 'Trainer', 'Elite', 'Ancient', 'Primal',
  'Crimson', 'Frozen', 'Blazing', 'Savage', 'Cosmic', 'Turbo', 'Wild', 'Chrome', 'Radiant', 'Toxic',
  'Nova', 'Velvet', 'Rogue', 'Iron', 'Crystal', 'Feral', 'Vivid', 'Prime', 'Astro', 'Quantum',
];
const NOUNS = [
  'Puller', 'Hunter', 'Collector', 'King', 'Queen', 'Master', 'Expert', 'Player', 'Gamer', 'Dragon',
  'Phoenix', 'Beast', 'Legend', 'Lord', 'Knight', 'Pikachu', 'Charizard', 'Mew', 'Ace', 'Champ',
  'Ranger', 'Wizard', 'Titan', 'Falcon', 'Wolf', 'Viper', 'Ghost', 'Samurai', 'Rocket', 'Nomad',
  'Striker', 'Raider', 'Voyager', 'Seeker', 'Blade', 'Storm', 'Ninja', 'Pilot', 'Rider', 'Scout',
  'Baron', 'Duke', 'Chief', 'Sensei', 'Rebel', 'Maverick', 'Pioneer', 'Glitch', 'Bandit', 'Cipher',
];

// Realistic-sounding handles -- a first name plus an ordinary suffix, so the
// feed doesn't read as 100% "AdjectiveNoun420" gamer-tag templates.
const REALISTIC_NAMES = [
  'Jake', 'Mike', 'Sarah', 'Alex', 'Chris', 'Jordan', 'Taylor', 'Sam', 'Morgan', 'Casey',
  'Riley', 'Dylan', 'Austin', 'Logan', 'Ethan', 'Noah', 'Mason', 'Lucas', 'Kayla', 'Emma',
  'Olivia', 'Ava', 'Sophia', 'Mia', 'Zoe', 'Lily', 'Grace', 'Nathan', 'Tyler', 'Brandon',
  'Justin', 'Kevin', 'Ryan', 'Derek', 'Marcus', 'Devon', 'Trevor', 'Cody', 'Hunter', 'Ashley',
];
const REALISTIC_SUFFIXES = ['_tcg', '.pulls', '_plays', 'gaming', '_official', 'ttv', '_yt', '.collects', '_packs', 'live', '_23', '.co'];

// Edgy gamer-tag style.
const EDGY_WORDS = [
  'Reaper', 'Venom', 'Shadow', 'Wraith', 'Phantom', 'Havoc', 'Carnage', 'Bloodmoon', 'Nightfall', 'Doom',
  'Vortex', 'Inferno', 'Nemesis', 'Onyx', 'Abyss', 'Grim', 'Feral', 'Savage', 'Rogue', 'Wicked',
];

// Cute/soft style.
const CUTE_WORDS = [
  'Mochi', 'Peach', 'Bunny', 'Kitty', 'Pudding', 'Marshmallow', 'Sprinkle', 'Cupcake', 'Boba', 'Cloud',
  'Honey', 'Berry', 'Cocoa', 'Daisy', 'Sugar', 'Pom', 'Waffle', 'Biscuit', 'Cinnamon', 'Nugget',
];

// Deliberately over-the-top / cringy internet-slang style, kept playful and
// PG -- the "so bad it's funny" usernames every leaderboard has a few of.
const CRINGY_WORDS = [
  'Yeet', 'Sigma', 'Poggers', 'NoScope', 'GigaChad', 'Sussy', 'Skibidi', 'Rizz', 'Gyatt', 'Fanum',
  'Based', 'Cracked', 'Goated', 'Zesty', 'Mewing', 'Ohio',
];

export function generateUsername(seed: string) {
  const rng = seededRandom(seed);
  const roll = rng();

  // Weighted mix of styles so the classic "AdjectiveNoun###" tag stays the
  // most common flavor but the feed reads as a real, varied playerbase
  // instead of one repeating template.
  if (roll < 0.4) {
    const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
    const num = Math.floor(rng() * 999);
    return `${adj}${noun}${num}`;
  }

  if (roll < 0.6) {
    const name = REALISTIC_NAMES[Math.floor(rng() * REALISTIC_NAMES.length)];
    const style = Math.floor(rng() * 3);
    if (style === 0) return `${name}${Math.floor(rng() * 99)}`;
    if (style === 1) return `${name}${REALISTIC_SUFFIXES[Math.floor(rng() * REALISTIC_SUFFIXES.length)]}`;
    return `${name.toLowerCase()}${REALISTIC_SUFFIXES[Math.floor(rng() * REALISTIC_SUFFIXES.length)]}`;
  }

  if (roll < 0.75) {
    const w = EDGY_WORDS[Math.floor(rng() * EDGY_WORDS.length)];
    const style = Math.floor(rng() * 4);
    if (style === 0) return `xX${w}Xx`;
    if (style === 1) return `${w}${[420, 666, 13, 99][Math.floor(rng() * 4)]}`;
    if (style === 2) return `${w}Slayer`;
    return `Lil${w}`;
  }

  if (roll < 0.9) {
    const w = CUTE_WORDS[Math.floor(rng() * CUTE_WORDS.length)];
    const style = Math.floor(rng() * 4);
    if (style === 0) return `${w}chan`;
    if (style === 1) return `sleepy${w}`;
    if (style === 2) return `${w}_uwu`;
    return `baby${w}${Math.floor(rng() * 99)}`;
  }

  const w = CRINGY_WORDS[Math.floor(rng() * CRINGY_WORDS.length)];
  const style = Math.floor(rng() * 3);
  if (style === 0) return `${w}Lord${Math.floor(rng() * 99)}`;
  if (style === 1) return `xX${w}Xx`;
  return `the${w}one`;
}

export function getDailySeed() {
  // Anchored to midnight Pacific (DST-aware), not each viewer's own local
  // midnight -- so every visitor sees the same simulated "today" values.
  return startOfDayInZone(new Date()).toISOString();
}

/**
 * Returns a value that increases slowly throughout the day, resetting at
 * midnight Pacific for every visitor regardless of their own timezone.
 * @param base Base value at start of day
 * @param perDay Total expected increase in 24h
 */
export function getDailyIncrementalValue(base: number, perDay: number) {
  const start = startOfDayInZone(new Date()).getTime();
  const elapsedMs = Date.now() - start;
  const msPerUnit = (86400 * 1000) / perDay;
  return base + Math.floor(elapsedMs / msPerUnit);
}
