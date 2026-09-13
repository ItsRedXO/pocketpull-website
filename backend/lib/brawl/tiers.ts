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
  // How much the opponent's roster is deliberately built to counter the
  // player's team (see opponentAI.ts) instead of picked at random: 0 for the
  // casual tiers, then a step up for each tournament tier so the AI visibly
  // plans harder the further the player climbs. Elite Four trainers should
  // feel like they scouted your team; Local Tournament opponents should not.
  strategyLevel: 0 | 1 | 2 | 3;
}

// Opponent bands are tuned against the real overall_rating distribution (see
// computeOverallRating/scaleBaseStat in rating.ts): weak basics land ~20-40,
// solid fully-evolved non-legendaries ~55-76 (e.g. Charizard ~66, Tyranitar
// ~76), and Legendaries/Mythicals are floored at 75 and run up into the
// high-80s/90s (Mewtwo ~86+) -- so 80s/90s territory exists and is reserved
// for the top tiers. Each tier's band both raises the floor and widens
// upward, and strategyLevel escalates alongside it (see opponentAI.ts).
export const BATTLE_TIERS: Record<BattleTierId, BattleTierConfig> = {
  local_battle: {
    id: 'local_battle', label: 'Local Battle', matches: 1, entryCost: 0, cooldownMs: 0,
    winReward: 150, lossReward: 50, opponentOverallMin: 15, opponentOverallMax: 38,
    unlockAfter: null, winCounterField: 'local_battles_played', strategyLevel: 0,
  },
  local_tournament: {
    id: 'local_tournament', label: 'Local Tournament', matches: 2, entryCost: 0, cooldownMs: 5 * 60 * 1000,
    totalReward: 500, lossConsolation: 50, opponentOverallMin: 50, opponentOverallMax: 60,
    unlockAfter: { counter: 'local_battles_played', count: 5 }, winCounterField: 'local_tournament_wins', strategyLevel: 0,
  },
  state_tournament: {
    id: 'state_tournament', label: 'State Tournament', matches: 3, entryCost: 250, cooldownMs: 15 * 60 * 1000,
    totalReward: 1500, lossConsolation: 0, opponentOverallMin: 60, opponentOverallMax: 75,
    unlockAfter: { counter: 'local_tournament_wins', count: 3 }, winCounterField: 'state_tournament_wins', strategyLevel: 1,
  },
  regional_tournament: {
    id: 'regional_tournament', label: 'Regional Tournament', matches: 3, entryCost: 750, cooldownMs: 60 * 60 * 1000,
    totalReward: 4500, lossConsolation: 0, opponentOverallMin: 65, opponentOverallMax: 80,
    unlockAfter: { counter: 'state_tournament_wins', count: 3 }, winCounterField: 'regional_tournament_wins', strategyLevel: 2,
  },
  elite_four: {
    id: 'elite_four', label: 'Elite Four', matches: 4, entryCost: 2000, cooldownMs: 6 * 60 * 60 * 1000,
    totalReward: 15000, lossConsolation: 0, opponentOverallMin: 75, opponentOverallMax: 85,
    unlockAfter: { counter: 'regional_tournament_wins', count: 3 }, winCounterField: 'elite_four_wins', strategyLevel: 3,
  },
};

export const DAILY_BATTLE_CAP = 250;

export const DAILY_BONUS_AMOUNT = 500;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface SafariTierConfig {
  tier: number;
  label: string;
  description: string;
  cost: number;
  count: number;
  overallMin: number;
  overallMax: number;
  bonusChance: number;
  bonusOverallMin: number;
  bonusOverallMax: number;
  // Evolution stages this tier's pool draws from (1 = basic, 2 = 2nd stage, 3 =
  // fully evolved). Omitted = every stage.
  stages?: number[];
  // Excludes true Legendaries / Mythicals from the pool. There's no dedicated
  // "pseudo-legendary" flag in the species table (Dragonite, Tyranitar, etc. are
  // just strong non-legendary mons), so that theme comes purely from the overall
  // range at tier 4+ once real Legendaries/Mythicals are allowed to compete for
  // those same high overall bands.
  excludeLegendary?: boolean;
  excludeMythical?: boolean;
}

// Same post-rescale calibration as BATTLE_TIERS above -- bands shifted down
// to fit the real ~15-73 overall_rating spread instead of the old 30-90.
export const SAFARI_TIERS: SafariTierConfig[] = [
  {
    tier: 1, label: 'Basic Evolutions', description: 'Every pull here is a basic, first-stage Pokemon.',
    cost: 500, count: 2, overallMin: 15, overallMax: 37, bonusChance: 0.05, bonusOverallMin: 38, bonusOverallMax: 45,
    stages: [1], excludeLegendary: true, excludeMythical: true,
  },
  {
    tier: 2, label: '2nd Stage Evolutions', description: 'A mix of first and second-stage Pokemon.',
    cost: 1250, count: 2, overallMin: 28, overallMax: 48, bonusChance: 0.05, bonusOverallMin: 49, bonusOverallMax: 56,
    stages: [1, 2], excludeLegendary: true, excludeMythical: true,
  },
  {
    tier: 3, label: '3rd Stage Evolutions', description: 'All three evolution stages are in the pool.',
    cost: 3000, count: 2, overallMin: 42, overallMax: 58, bonusChance: 0.05, bonusOverallMin: 55, bonusOverallMax: 66,
    excludeLegendary: true, excludeMythical: true,
  },
  {
    tier: 4, label: 'Pseudo-Legendaries & Mythicals', description: 'Where Mythicals and near-legendary powerhouses start showing up.',
    cost: 6500, count: 2, overallMin: 52, overallMax: 64, bonusChance: 0.05, bonusOverallMin: 62, bonusOverallMax: 73,
    excludeLegendary: true,
  },
  {
    tier: 5, label: 'Legends Encounter', description: 'Change the future with a legendary pull.',
    cost: 12000, count: 2, overallMin: 58, overallMax: 73, bonusChance: 0.05, bonusOverallMin: 65, bonusOverallMax: 80,
  },
];
