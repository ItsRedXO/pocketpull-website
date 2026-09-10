import type { PokeType } from './typeChart';

// Poke Brawl does not model each species' canonical movepool (that would mean
// hand-curating ~1000+ movesets). Instead every species gets a small, type-derived
// kit: this keeps the type chart / matchup strategy the game is built around while
// staying implementable and balanceable. vfx selects which battle-log animation the
// frontend replays (see the "full animated sim" battle renderer).
export interface BrawlMove {
  name: string;
  type: PokeType;
  power: number;
  category: 'physical' | 'special';
  vfx: string;
}

export const FILLER_MOVES: BrawlMove[] = [
  { name: 'Tackle', type: 'normal', power: 35, category: 'physical', vfx: 'tackle' },
  { name: 'Scratch', type: 'normal', power: 35, category: 'physical', vfx: 'scratch' },
  { name: 'Quick Attack', type: 'normal', power: 30, category: 'physical', vfx: 'quick-attack' },
];

const TYPE_MOVES: Record<PokeType, BrawlMove[]> = {
  normal: [
    { name: 'Hyper Voice', type: 'normal', power: 55, category: 'special', vfx: 'hyper-voice' },
    { name: 'Slam', type: 'normal', power: 60, category: 'physical', vfx: 'slam' },
  ],
  fire: [
    { name: 'Ember', type: 'fire', power: 40, category: 'special', vfx: 'ember' },
    { name: 'Flamethrower', type: 'fire', power: 65, category: 'special', vfx: 'flamethrower' },
  ],
  water: [
    { name: 'Bubble', type: 'water', power: 40, category: 'special', vfx: 'bubble' },
    { name: 'Hydro Pump', type: 'water', power: 65, category: 'special', vfx: 'hydro-pump' },
  ],
  electric: [
    { name: 'Spark', type: 'electric', power: 40, category: 'physical', vfx: 'spark' },
    { name: 'Thunderbolt', type: 'electric', power: 65, category: 'special', vfx: 'thunderbolt' },
  ],
  grass: [
    { name: 'Vine Whip', type: 'grass', power: 40, category: 'physical', vfx: 'vine-whip' },
    { name: 'Solar Beam', type: 'grass', power: 65, category: 'special', vfx: 'solar-beam' },
  ],
  ice: [
    { name: 'Ice Shard', type: 'ice', power: 40, category: 'physical', vfx: 'ice-shard' },
    { name: 'Blizzard', type: 'ice', power: 65, category: 'special', vfx: 'blizzard' },
  ],
  fighting: [
    { name: 'Karate Chop', type: 'fighting', power: 40, category: 'physical', vfx: 'karate-chop' },
    { name: 'Close Combat', type: 'fighting', power: 65, category: 'physical', vfx: 'close-combat' },
  ],
  poison: [
    { name: 'Poison Sting', type: 'poison', power: 40, category: 'physical', vfx: 'poison-sting' },
    { name: 'Sludge Bomb', type: 'poison', power: 65, category: 'special', vfx: 'sludge-bomb' },
  ],
  ground: [
    { name: 'Mud Slap', type: 'ground', power: 40, category: 'special', vfx: 'mud-slap' },
    { name: 'Earthquake', type: 'ground', power: 65, category: 'physical', vfx: 'earthquake' },
  ],
  flying: [
    { name: 'Gust', type: 'flying', power: 40, category: 'special', vfx: 'gust' },
    { name: 'Aerial Ace', type: 'flying', power: 60, category: 'physical', vfx: 'aerial-ace' },
  ],
  psychic: [
    { name: 'Confusion', type: 'psychic', power: 40, category: 'special', vfx: 'confusion' },
    { name: 'Psychic', type: 'psychic', power: 65, category: 'special', vfx: 'psychic' },
  ],
  bug: [
    { name: 'Bug Bite', type: 'bug', power: 40, category: 'physical', vfx: 'bug-bite' },
    { name: 'X-Scissor', type: 'bug', power: 60, category: 'physical', vfx: 'x-scissor' },
  ],
  rock: [
    { name: 'Rock Throw', type: 'rock', power: 40, category: 'physical', vfx: 'rock-throw' },
    { name: 'Rock Slide', type: 'rock', power: 60, category: 'physical', vfx: 'rock-slide' },
  ],
  ghost: [
    { name: 'Lick', type: 'ghost', power: 35, category: 'physical', vfx: 'lick' },
    { name: 'Shadow Ball', type: 'ghost', power: 65, category: 'special', vfx: 'shadow-ball' },
  ],
  dragon: [
    { name: 'Dragon Breath', type: 'dragon', power: 45, category: 'special', vfx: 'dragon-breath' },
    { name: 'Dragon Claw', type: 'dragon', power: 65, category: 'physical', vfx: 'dragon-claw' },
  ],
  dark: [
    { name: 'Bite', type: 'dark', power: 40, category: 'physical', vfx: 'bite' },
    { name: 'Crunch', type: 'dark', power: 60, category: 'physical', vfx: 'crunch' },
  ],
  steel: [
    { name: 'Metal Claw', type: 'steel', power: 40, category: 'physical', vfx: 'metal-claw' },
    { name: 'Iron Head', type: 'steel', power: 60, category: 'physical', vfx: 'iron-head' },
  ],
  fairy: [
    { name: 'Fairy Wind', type: 'fairy', power: 40, category: 'special', vfx: 'fairy-wind' },
    { name: 'Moonblast', type: 'fairy', power: 65, category: 'special', vfx: 'moonblast' },
  ],
};

export function buildMoveset(primaryType: PokeType, secondaryType: PokeType | null): BrawlMove[] {
  const moves = [FILLER_MOVES[Math.floor(Math.random() * FILLER_MOVES.length)]];
  moves.push(...TYPE_MOVES[primaryType]);
  if (secondaryType) moves.push(TYPE_MOVES[secondaryType][1]);
  return moves;
}
