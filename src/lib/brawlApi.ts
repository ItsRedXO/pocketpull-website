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
  overall_rating: number; evolution_stage: number; is_legendary: number; is_mythical: number; sprite_url: string | null; artwork_url: string | null;
  portrait_scale: number; portrait_offset_x: number; portrait_offset_y: number;
}
export interface BrawlInstance extends Omit<BrawlSpecies, 'id'> {
  id: string; species_id: number; nickname: string | null; source: string; is_on_team: number; team_slot: number | null; acquired_at: string;
}
export interface BrawlProfile {
  user_id: string; has_completed_intro: number; league: string; league_rating: number; wins: number; losses: number;
  local_battles_played: number; local_tournament_wins: number; state_tournament_wins: number; regional_tournament_wins: number; elite_four_wins: number;
}
export interface BattleTierConfig {
  id: string; label: string; matches: number; entryCost: number; cooldownMs: number;
  winReward?: number; lossReward?: number; totalReward?: number; lossConsolation?: number;
  opponentOverallMin: number; opponentOverallMax: number;
  unlockAfter: { counter: string; count: number } | null;
}
export interface SafariTierConfig { tier: number; cost: number; count: number; overallMin: number; overallMax: number; bonusChance: number; bonusOverallMin: number; bonusOverallMax: number; }
export interface BrawlConfig {
  battleTiers: Record<string, BattleTierConfig>; safariTiers: SafariTierConfig[]; dailyBattleCap: number;
  tierRatingDeltas: Record<string, { win: number; loss: number }>;
}

export interface BrawlProfileResponse {
  profile: BrawlProfile; balance: number; rosterCount: number; dailyBattlesUsed: number; dailyBattleCap: number;
  tierStatus: Record<string, { unlocked: boolean; cooldownEndsAt: string | null }>;
}

export const getBrawlConfig = () => get<BrawlConfig>('/brawl/config');
export const getBrawlProfile = () => get<BrawlProfileResponse>('/brawl/profile');
export const completeBrawlIntro = () => post<{ success: boolean; alreadyCompleted?: boolean; roster?: BrawlInstance[] }>('/brawl/intro/complete');
export const getBrawlRoster = () => get<{ roster: BrawlInstance[] }>('/brawl/roster');
export const setBrawlTeam = (instanceIds: string[]) => post<{ success: boolean; roster: BrawlInstance[] }>('/brawl/team', { instanceIds });
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
