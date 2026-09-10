import type { BattleTierId } from './tiers';

export type LeagueId = 'standard' | 'great' | 'ultra' | 'master';

export interface LeagueTier { id: LeagueId; label: string; minRating: number; color: string; }

// Ordered low -> high. A profile's league is always the highest tier whose
// minRating it currently meets or exceeds.
export const LEAGUES: LeagueTier[] = [
  { id: 'standard', label: 'Standard League', minRating: 0, color: '#a8a878' },
  { id: 'great', label: 'Great League', minRating: 1200, color: '#6890f0' },
  { id: 'ultra', label: 'Ultra League', minRating: 1800, color: '#9b5cff' },
  { id: 'master', label: 'Master League', minRating: 2400, color: '#f8d030' },
];
const LEAGUE_ORDER: LeagueId[] = LEAGUES.map(l => l.id);

export function leagueForRating(rating: number): LeagueTier {
  let current = LEAGUES[0];
  for (const tier of LEAGUES) if (rating >= tier.minRating) current = tier;
  return current;
}

export function leagueRank(id: string): number {
  const idx = LEAGUE_ORDER.indexOf(id as LeagueId);
  return idx === -1 ? 0 : idx;
}

// Fixed points per match rather than a dynamic Elo expected-score calc: opponents
// are AI-generated per tier (not persistent rated players), so a simple
// higher-stakes-tier-moves-it-more scale is easier to reason about and tune than
// modeling an "opponent rating" for a simulated 6v6.
export const TIER_RATING_DELTA: Record<BattleTierId, { win: number; loss: number }> = {
  local_battle: { win: 15, loss: -8 },
  local_tournament: { win: 20, loss: -10 },
  state_tournament: { win: 25, loss: -12 },
  regional_tournament: { win: 30, loss: -15 },
  elite_four: { win: 40, loss: -20 },
};
