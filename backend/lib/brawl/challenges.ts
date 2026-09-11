import { uid } from '../auth';
import type { PokeType } from './typeChart';

// Challenge constants/logic. The template catalog itself lives in the
// brawl_challenge_templates table (admin-editable -- see
// repositories/brawlChallenges.ts) rather than here; this file only holds
// the shapes and the pure rendering logic that turns a template row into a
// concrete offered challenge.
//
// A player is offered 3 random active templates at a time, picks 1, and
// it's locked in until completed (win-only progress -- losing never resets
// it) or 15 minutes pass with it un-picked.
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

export const ALL_TYPES: PokeType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export interface ChallengeTemplateRow {
  key: string;
  type: ChallengeType;
  label: string;
  description: string;
  target: number;
  reward_kind: 'pokedollars' | 'pokemon';
  reward_amount: number | null;
  reward_overall_min: number | null;
  reward_overall_max: number | null;
  fixed_type: string | null;
  active: boolean;
}

function renderPlaceholders(text: string, type: PokeType | null): string {
  if (!type) return text;
  const capitalized = `${type[0].toUpperCase()}${type.slice(1)}`;
  return text.replace(/\{Type\}/g, capitalized).replace(/\{type\}/g, type);
}

/**
 * Turns a template row into a concrete offered challenge: rolls a random
 * PokeType for win_mono_type templates (unless fixed_type pins one), and
 * substitutes {Type}/{type} placeholders in the label/description.
 */
export function buildChallengeInstance(row: ChallengeTemplateRow): ChallengeInstance {
  const type: PokeType | null = row.type === 'win_mono_type'
    ? ((row.fixed_type as PokeType | null) || ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)])
    : null;
  const reward: ChallengeReward = row.reward_kind === 'pokedollars'
    ? { kind: 'pokedollars', amount: row.reward_amount || 0 }
    : { kind: 'pokemon', overallMin: row.reward_overall_min ?? 1, overallMax: row.reward_overall_max ?? 100 };
  return {
    id: uid(),
    templateKey: row.key,
    type: row.type,
    label: renderPlaceholders(row.label, type),
    description: renderPlaceholders(row.description, type),
    target: row.target,
    meta: type ? { type } : undefined,
    reward,
  };
}
