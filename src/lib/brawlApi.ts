import { getPreferredAuthToken } from './blink';
import { BACKEND_BASE } from './backend';

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try { const token = await getPreferredAuthToken(); if (token) h.Authorization = `Bearer ${token}`; } catch { /* unauthenticated */ }
  return h;
}
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { headers: await headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Poke Brawl API error ${res.status}`);
  return data as T;
}
async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Poke Brawl API error ${res.status}`);
  return data as T;
}

export type PokeType = 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface BrawlSpecies {
  id: number; name: string; primary_type: PokeType; secondary_type: PokeType | null;
  base_hp: number; base_attack: number; base_defense: number; base_sp_attack: number; base_sp_defense: number; base_speed: number;
  overall_rating: number; evolution_stage: number; evolves_to: number[]; is_legendary: number; is_mythical: number;
  card_tier_override: string | null; sprite_url: string | null; artwork_url: string | null;
  portrait_scale: number; portrait_offset_x: number; portrait_offset_y: number;
}
export interface BrawlInstance extends Omit<BrawlSpecies, 'id'> {
  id: string; species_id: number; nickname: string | null; source: string; is_on_team: number; team_slot: number | null; star_level: number; acquired_at: string;
}
export interface BrawlProfile {
  user_id: string; has_completed_intro: number; league: string; league_rating: number; wins: number; losses: number;
  local_battles_played: number; local_tournament_wins: number; state_tournament_wins: number; regional_tournament_wins: number; elite_four_wins: number;
  daily_bonus_claimed_at: string | null;
}
export interface BattleTierConfig {
  id: string; label: string; matches: number; entryCost: number; cooldownMs: number;
  winReward?: number; lossReward?: number; totalReward?: number; lossConsolation?: number;
  opponentOverallMin: number; opponentOverallMax: number;
  unlockAfter: { counter: string; count: number } | null;
}
export interface SafariTierConfig {
  tier: number; label: string; description: string; cost: number; count: number;
  overallMin: number; overallMax: number; bonusChance: number; bonusOverallMin: number; bonusOverallMax: number;
  stages?: number[]; excludeLegendary?: boolean; excludeMythical?: boolean;
}
export interface BrawlConfig {
  battleTiers: Record<string, BattleTierConfig>; safariTiers: SafariTierConfig[]; dailyBattleCap: number;
  tierRatingDeltas: Record<string, { win: number; loss: number }>;
}

export interface DailyBonusStatus { amount: number; claimable: boolean; nextClaimAt: string | null; }
export interface RankInfo { rank: number; total: number; }
export interface BrawlProfileResponse {
  profile: BrawlProfile; balance: number; rosterCount: number; dailyBattlesUsed: number; dailyBattleCap: number;
  tierStatus: Record<string, { unlocked: boolean; cooldownEndsAt: string | null }>;
  dailyBonus: DailyBonusStatus;
  rank: RankInfo;
}
export interface DailyBonusClaimResult { success: boolean; amount: number; claimedAt: string; nextClaimAt: string; balance: number; }

export const getBrawlConfig = () => get<BrawlConfig>('/brawl/config');
export const getBrawlSpeciesCatalog = () => get<{ species: BrawlSpecies[] }>('/brawl/species');
export const getBrawlProfile = () => get<BrawlProfileResponse>('/brawl/profile');
export const claimBrawlDailyBonus = () => post<DailyBonusClaimResult>('/brawl/daily-bonus/claim');
export const completeBrawlIntro = () => post<{ success: boolean; alreadyCompleted?: boolean; roster?: BrawlInstance[] }>('/brawl/intro/complete');
export const getBrawlRoster = () => get<{ roster: BrawlInstance[] }>('/brawl/roster');
export const setBrawlTeam = (instanceIds: string[]) => post<{ success: boolean; roster: BrawlInstance[] }>('/brawl/team', { instanceIds });
export const EVOLVE_COST_STAGE_1 = 3;
export const EVOLVE_COST_STAGE_2_PLUS = 5;
export const STAR_UPGRADE_FODDER_COUNT = 4;
export const MAX_STAR_LEVEL = 3;
export const evolveBrawlRoster = (sourceSpeciesId: number, targetSpeciesId: number, instanceIds: string[]) =>
  post<{ success: boolean; newInstanceId: string; roster: BrawlInstance[] }>('/brawl/roster/evolve', { sourceSpeciesId, targetSpeciesId, instanceIds });
export const starUpgradeBrawlRoster = (targetInstanceId: string, fodderInstanceIds: string[]) =>
  post<{ success: boolean; newStarLevel: number; roster: BrawlInstance[] }>('/brawl/roster/star-upgrade', { targetInstanceId, fodderInstanceIds });
export interface LeaderboardEntry { user_id: string; username: string | null; avatar_url: string | null; league: string; league_rating: number; wins: number; losses: number; }
export const getBrawlLeaderboard = () => get<{ leaderboard: LeaderboardEntry[] }>('/brawl/leaderboard');
export interface TrainerProfile {
  userId: string; username: string | null; avatarUrl: string | null;
  leagueRating: number; wins: number; losses: number;
  regionalTournamentWins: number; eliteFourWins: number; challengesCompleted: number;
  team: BrawlSpecies[];
}
export const getBrawlTrainer = (userId: string) => get<{ trainer: TrainerProfile }>(`/brawl/trainer/${encodeURIComponent(userId)}`);
export const pullSafariZone = (tier: number) => post<{ success: boolean; pulled: BrawlSpecies[]; instanceIds: string[]; balance: number }>('/brawl/safari/pull', { tier });

export type Effectiveness = 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';
export type ArenaSide = 'user' | 'opponent';
export interface ArenaPokemonState {
  id: string; side: ArenaSide; speciesId: number; name: string;
  x: number; y: number; hp: number; maxHp: number; fainted: boolean;
  artworkUrl: string | null; primaryType: PokeType; secondaryType: PokeType | null;
}
export interface ArenaAttackEvent {
  attackerId: string; defenderId: string; move: string; moveType: PokeType; vfx: string;
  damage: number; effectiveness: Effectiveness; fromX: number; fromY: number; toX: number; toY: number;
}
export interface ArenaFaintEvent { pokemonId: string; side: ArenaSide; name: string; }
export interface ArenaFrame {
  tick: number; pokemon: ArenaPokemonState[]; attacks: ArenaAttackEvent[]; faints: ArenaFaintEvent[]; koUser: number; koOpponent: number;
}
export interface ArenaObstacle { x1: number; y1: number; x2: number; y2: number; }
export interface BrawlMatchResult { index: number; result: 'win' | 'loss'; opponentSpeciesIds: number[]; frames: ArenaFrame[]; obstacles: ArenaObstacle[]; maxTicks: number; }
export interface RatingChangeResult { previousRating: number; newRating: number; }
export interface BrawlBattlePlayResult {
  success: boolean; tier: string; status: 'won' | 'eliminated'; matchesWon: number; matchesTotal: number; reward: number; balance: number; matches: BrawlMatchResult[];
  rating: RatingChangeResult;
}
export const playBrawlBattle = (tier: string) => post<BrawlBattlePlayResult>('/brawl/battle/play', { tier });

export type ChallengeType = 'win_matches' | 'win_tournament' | 'evolve_pokemon' | 'open_safari' | 'win_mono_type';
export type ChallengeReward =
  | { kind: 'pokedollars'; amount: number }
  | { kind: 'pokemon'; overallMin: number; overallMax: number };
export interface ChallengeInstance {
  id: string; templateKey: string; type: ChallengeType;
  label: string; description: string; target: number;
  meta?: { type?: PokeType };
  reward: ChallengeReward;
}
export interface LastCompletedChallenge {
  label: string; reward: ChallengeReward;
  pokemon?: { id: number; name: string; artworkUrl: string | null; overallRating: number };
  completedAt: string;
}
export interface ChallengeStatus {
  status: 'select' | 'active' | 'cooldown';
  offered: ChallengeInstance[];
  active: (ChallengeInstance & { progress: number }) | null;
  cooldownEndsAt: string | null;
  lastCompleted: LastCompletedChallenge | null;
}
export const getBrawlChallenges = () => get<ChallengeStatus>('/brawl/challenges');
export const selectBrawlChallenge = (challengeId: string) => post<{ success: boolean; active: ChallengeInstance & { progress: number } }>('/brawl/challenges/select', { challengeId });
export interface ChallengeClaimResult {
  success: boolean; label: string; reward: ChallengeReward;
  pokemon?: { id: number; name: string; artworkUrl: string | null; overallRating: number };
  balance: number;
}
export const claimBrawlChallenge = () => post<ChallengeClaimResult>('/brawl/challenges/claim');

export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'stone' | 'held' | 'other';
export interface BrawlItemDef {
  key: string; name: string; description: string; rarity: ItemRarity; kind: ItemKind; price: number; spriteUrl: string | null; active: boolean;
}
export interface ItemShopStatus { items: BrawlItemDef[]; rotatedAt: string; nextRotateAt: string; }
export const getBrawlItemShop = () => get<ItemShopStatus>('/brawl/items/shop');
export interface ItemInventoryEntry { itemKey: string; quantity: number; item: BrawlItemDef; }
export const getBrawlItemInventory = () => get<{ inventory: ItemInventoryEntry[] }>('/brawl/items/inventory');
export const buyBrawlItem = (itemKey: string) => post<{ success: boolean; balance: number; quantity: number; itemKey: string }>('/brawl/items/buy', { itemKey });
