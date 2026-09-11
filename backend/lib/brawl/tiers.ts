// Single source of truth for Poke Brawl's economy. Both the battle/tournament
// routes and the GET /brawl/config endpoint (which the frontend reads to render
// tier cards) pull from here, so cost/prize/cooldown numbers never drift.

export type BattleTierId = 'local_battle' | 'local_tournament' | 'state_tournament' | 'regional_tournament' | 'elite_four';

export interface UnlockRule {
  // Which brawl_profiles counter gates this tier, and how many are needed.
  counter: 'local_battles_played' | 'local_tournament_wins' | 'state_tournament_wins' | 'regional_tournament_wins';
  count: number;
}

export interface BattleTierConfig {
  id: BattleTierId;
  label: string;
  matches: number;
  entryCost: number;
  cooldownMs: number;
  // local_battle pays per-match; the tournament tiers pay a flat prize on
  // clearing every match, plus a smaller consolation if eliminated early.
  winReward?: number;
  lossReward?: number;
  totalReward?: number;
  lossConsolation?: number;
  opponentOverallMin: number;
  opponentOverallMax: number;
  unlockAfter: UnlockRule | null;
  winCounterField: 'local_battles_played' | 'local_tournament_wins' | 'state_tournament_wins' | 'regional_tournament_wins' | 'elite_four_wins';
}

export const BATTLE_TIERS: Record<BattleTierId, BattleTierConfig> = {
  local_battle: {
    id: 'local_battle', label: 'Local Battle', matches: 1, entryCost: 0, cooldownMs: 0,
    winReward: 150, lossReward: 50, opponentOverallMin: 40, opponentOverallMax: 55,
    unlockAfter: null, winCounterField: 'local_battles_played',
  },
  local_tournament: {
    id: 'local_tournament', label: 'Local Tournament', matches: 2, entryCost: 0, cooldownMs: 5 * 60 * 1000,
    totalReward: 500, lossConsolation: 50, opponentOverallMin: 40, opponentOverallMax: 58,
    unlockAfter: { counter: 'local_battles_played', count: 5 }, winCounterField: 'local_tournament_wins',
  },
  state_tournament: {
    id: 'state_tournament', label: 'State Tournament', matches: 3, entryCost: 250, cooldownMs: 15 * 60 * 1000,
    totalReward: 1500, lossConsolation: 0, opponentOverallMin: 45, opponentOverallMax: 62,
    unlockAfter: { counter: 'local_tournament_wins', count: 3 }, winCounterField: 'state_tournament_wins',
  },
  regional_tournament: {
    id: 'regional_tournament', label: 'Regional Tournament', matches: 3, entryCost: 750, cooldownMs: 60 * 60 * 1000,
    totalReward: 4500, lossConsolation: 0, opponentOverallMin: 50, opponentOverallMax: 68,
    unlockAfter: { counter: 'state_tournament_wins', count: 3 }, winCounterField: 'regional_tournament_wins',
  },
  elite_four: {
    id: 'elite_four', label: 'Elite Four', matches: 4, entryCost: 2000, cooldownMs: 6 * 60 * 60 * 1000,
    totalReward: 15000, lossConsolation: 0, opponentOverallMin: 58, opponentOverallMax: 80,
    unlockAfter: { counter: 'regional_tournament_wins', count: 3 }, winCounterField: 'elite_four_wins',
  },
};

export const DAILY_BATTLE_CAP = 250;

export const DAILY_BONUS_AMOUNT = 500;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface SafariTierConfig {
  tier: number;
  cost: number;
  count: number;
  overallMin: number;
  overallMax: number;
  bonusChance: number;
  bonusOverallMin: number;
  bonusOverallMax: number;
}

export const SAFARI_TIERS: SafariTierConfig[] = [
  { tier: 1, cost: 500, count: 2, overallMin: 48, overallMax: 55, bonusChance: 0.05, bonusOverallMin: 56, bonusOverallMax: 70 },
  { tier: 2, cost: 1250, count: 2, overallMin: 48, overallMax: 60, bonusChance: 0.08, bonusOverallMin: 61, bonusOverallMax: 75 },
  { tier: 3, cost: 3000, count: 2, overallMin: 50, overallMax: 65, bonusChance: 0.06, bonusOverallMin: 66, bonusOverallMax: 80 },
  { tier: 4, cost: 6500, count: 2, overallMin: 55, overallMax: 70, bonusChance: 0.06, bonusOverallMin: 71, bonusOverallMax: 85 },
  { tier: 5, cost: 12000, count: 2, overallMin: 60, overallMax: 80, bonusChance: 0.07, bonusOverallMin: 81, bonusOverallMax: 99 },
];
