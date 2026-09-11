import { uid } from '../auth';
import type { PokeType } from './typeChart';

// Single source of truth for Poke Brawl Challenges, mirroring how tiers.ts
// anchors the battle/safari economy. A player is offered 3 random templates
// at a time, picks 1, and it's locked in until completed (win-only progress --
// losing never resets it) or 15 minutes pass with it un-picked.
export const CHALLENGE_COOLDOWN_MS = 15 * 60 * 1000;
export const CHALLENGE_OPTIONS_COUNT = 3;

export type ChallengeType = 'win_matches' | 'win_tournament' | 'evolve_pokemon' | 'open_safari' | 'win_mono_type';

export type ChallengeReward =
  | { kind: 'pokedollars'; amount: number }
  | { kind: 'pokemon'; overallMin: number; overallMax: number };

export interface ChallengeInstance {
  id: string;
  templateKey: string;
  type: ChallengeType;
  label: string;
  description: string;
  target: number;
  meta?: { type?: PokeType };
  reward: ChallengeReward;
}

const ALL_TYPES: PokeType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

interface ChallengeTemplate {
  key: string;
  build: () => Omit<ChallengeInstance, 'id'>;
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { key: 'win_3', build: () => ({
    templateKey: 'win_3', type: 'win_matches', target: 3,
    label: 'Win 3 Battles', description: 'Win 3 Poke Brawl matches, any tier. Losses don\'t set you back.',
    reward: { kind: 'pokedollars', amount: 350 },
  }) },
  { key: 'win_5', build: () => ({
    templateKey: 'win_5', type: 'win_matches', target: 5,
    label: 'Win 5 Battles', description: 'Win 5 Poke Brawl matches, any tier. Losses don\'t set you back.',
    reward: { kind: 'pokedollars', amount: 600 },
  }) },
  { key: 'win_8', build: () => ({
    templateKey: 'win_8', type: 'win_matches', target: 8,
    label: 'Win 8 Battles', description: 'Win 8 Poke Brawl matches, any tier. Losses don\'t set you back.',
    reward: { kind: 'pokedollars', amount: 1000 },
  }) },
  { key: 'win_tournament', build: () => ({
    templateKey: 'win_tournament', type: 'win_tournament', target: 1,
    label: 'Win Any Tournament', description: 'Clear a Local, State, Regional, or Elite Four tournament run.',
    reward: { kind: 'pokedollars', amount: 800 },
  }) },
  { key: 'win_tournament_2', build: () => ({
    templateKey: 'win_tournament_2', type: 'win_tournament', target: 2,
    label: 'Win 2 Tournaments', description: 'Clear 2 tournament runs, any tier.',
    reward: { kind: 'pokemon', overallMin: 55, overallMax: 68 },
  }) },
  { key: 'evolve_1', build: () => ({
    templateKey: 'evolve_1', type: 'evolve_pokemon', target: 1,
    label: 'Evolve a Pokemon', description: 'Merge duplicates to evolve any Pokemon in your roster.',
    reward: { kind: 'pokedollars', amount: 400 },
  }) },
  { key: 'evolve_2', build: () => ({
    templateKey: 'evolve_2', type: 'evolve_pokemon', target: 2,
    label: 'Evolve 2 Pokemon', description: 'Merge duplicates to evolve 2 Pokemon in your roster.',
    reward: { kind: 'pokemon', overallMin: 45, overallMax: 55 },
  }) },
  { key: 'safari_3', build: () => ({
    templateKey: 'safari_3', type: 'open_safari', target: 3,
    label: 'Open the Safari Zone 3 Times', description: 'Make 3 Safari Zone pulls, any tier.',
    reward: { kind: 'pokedollars', amount: 700 },
  }) },
  { key: 'safari_5', build: () => ({
    templateKey: 'safari_5', type: 'open_safari', target: 5,
    label: 'Open the Safari Zone 5 Times', description: 'Make 5 Safari Zone pulls, any tier.',
    reward: { kind: 'pokemon', overallMin: 40, overallMax: 50 },
  }) },
  { key: 'mono_type', build: () => {
    const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
    const label = `${type[0].toUpperCase()}${type.slice(1)}`;
    return {
      templateKey: 'mono_type', type: 'win_mono_type', target: 1,
      label: `Win an All-${label} Battle`,
      description: `Win a match while fielding a full 6-Pokemon team that's entirely ${type}-type.`,
      meta: { type },
      reward: { kind: 'pokemon', overallMin: 50, overallMax: 60 },
    };
  } },
];

export function generateChallengeOptions(count = CHALLENGE_OPTIONS_COUNT): ChallengeInstance[] {
  const pool = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
  return pool.map(t => ({ id: uid(), ...t.build() }));
}
