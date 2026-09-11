import type { PoolClient } from 'pg';
import { query, transaction } from '../lib/postgres';
import { uid } from '../lib/auth';
import type { BattleSpecies } from '../lib/brawl/battleSim';
import type { PokeType } from '../lib/brawl/typeChart';
import { DAILY_BONUS_COOLDOWN_MS } from '../lib/brawl/tiers';

export interface SpeciesRow {
  id: number; name: string; primary_type: string; secondary_type: string | null;
  base_hp: number; base_attack: number; base_defense: number; base_sp_attack: number; base_sp_defense: number; base_speed: number;
  overall_rating: number; evolution_stage: number; evolution_chain_id: number; evolves_to: number[];
  is_legendary: number; is_mythical: number; sprite_url: string | null; artwork_url: string | null;
  portrait_scale: number; portrait_offset_x: number; portrait_offset_y: number;
}

export function speciesRowToBattleSpecies(row: SpeciesRow): BattleSpecies {
  return {
    speciesId: row.id, name: row.name, primaryType: row.primary_type as PokeType, secondaryType: row.secondary_type as PokeType | null,
    baseHp: row.base_hp, attack: row.base_attack, defense: row.base_defense, spAttack: row.base_sp_attack, spDefense: row.base_sp_defense,
    speed: row.base_speed, overall: row.overall_rating, spriteUrl: row.sprite_url, artworkUrl: row.artwork_url,
  };
}

// +5% to every stat per star level, uncapped by the species' usual 1-100 base
// stat ceiling -- that cap is about how strong a *species* can naturally be,
// not how far a specific player's ascended, held-item-bearing individual can
// go. A fresh (0-star) instance is unaffected.
export const STAR_STAT_BONUS_PER_LEVEL = 0.05;
export function applyStarBonus(species: BattleSpecies, starLevel: number): BattleSpecies {
  if (!starLevel) return species;
  const mult = 1 + STAR_STAT_BONUS_PER_LEVEL * starLevel;
  return {
    ...species,
    baseHp: Math.round(species.baseHp * mult), attack: Math.round(species.attack * mult), defense: Math.round(species.defense * mult),
    spAttack: Math.round(species.spAttack * mult), spDefense: Math.round(species.spDefense * mult), speed: Math.round(species.speed * mult),
    overall: Math.round(species.overall * mult),
  };
}

export async function listAllSpecies(): Promise<SpeciesRow[]> {
  return query<SpeciesRow>('SELECT * FROM brawl_pokemon_species ORDER BY id');
}

export async function getSpeciesByIds(ids: number[]): Promise<SpeciesRow[]> {
  if (!ids.length) return [];
  return query<SpeciesRow>('SELECT * FROM brawl_pokemon_species WHERE id = ANY($1)', [ids]);
}

export async function pickRandomSpeciesIds(count: number, opts: { overallMin?: number; overallMax?: number; evolutionStage?: number } = {}): Promise<number[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.overallMin != null) { params.push(opts.overallMin); clauses.push(`overall_rating >= $${params.length}`); }
  if (opts.overallMax != null) { params.push(opts.overallMax); clauses.push(`overall_rating <= $${params.length}`); }
  if (opts.evolutionStage != null) { params.push(opts.evolutionStage); clauses.push(`evolution_stage = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(count);
  const rows = await query<{ id: number }>(`SELECT id FROM brawl_pokemon_species ${where} ORDER BY random() LIMIT $${params.length}`, params);
  return rows.map(r => r.id);
}

const SPECIES_EDITABLE_COLUMNS = new Set(['name', 'primary_type', 'secondary_type', 'base_hp', 'base_attack', 'base_defense', 'base_sp_attack', 'base_sp_defense', 'base_speed', 'overall_rating', 'sprite_url', 'artwork_url', 'portrait_scale', 'portrait_offset_x', 'portrait_offset_y']);
export async function updateSpecies(id: number, fields: Record<string, unknown>): Promise<SpeciesRow | null> {
  const entries = Object.entries(fields).filter(([k]) => SPECIES_EDITABLE_COLUMNS.has(k));
  if (!entries.length) return (await query<SpeciesRow>('SELECT * FROM brawl_pokemon_species WHERE id=$1', [id]))[0] || null;
  const sets = entries.map(([k], i) => `${k}=$${i + 1}`).join(',');
  const params = entries.map(([, v]) => v);
  params.push(id);
  return (await query<SpeciesRow>(`UPDATE brawl_pokemon_species SET ${sets} WHERE id=$${params.length} RETURNING *`, params))[0] || null;
}

export interface BrawlProfile {
  user_id: string; has_completed_intro: number; league: string; league_rating: number; wins: number; losses: number;
  local_battles_played: number; local_tournament_wins: number; state_tournament_wins: number; regional_tournament_wins: number; elite_four_wins: number;
  daily_bonus_claimed_at: string | null;
}
export async function getOrCreateProfile(userId: string): Promise<BrawlProfile> {
  const existing = await query<BrawlProfile>('SELECT * FROM brawl_profiles WHERE user_id=$1', [userId]);
  if (existing[0]) return existing[0];
  return (await query<BrawlProfile>('INSERT INTO brawl_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *', [userId]))[0];
}
export async function completeIntro(userId: string): Promise<void> {
  await query('UPDATE brawl_profiles SET has_completed_intro=1, updated_at=now() WHERE user_id=$1', [userId]);
}
export async function incrementProfileCounters(userId: string, fields: Partial<Record<keyof BrawlProfile, number>>, client?: PoolClient): Promise<void> {
  const entries = Object.entries(fields).filter(([, v]) => typeof v === 'number' && v !== 0);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k}=${k}+$${i + 1}`).join(',');
  const params: unknown[] = entries.map(([, v]) => v);
  params.push(userId);
  const runner = client ? (sql: string, p: unknown[]) => client.query(sql, p) : (sql: string, p: unknown[]) => query(sql, p);
  await runner(`UPDATE brawl_profiles SET ${sets}, updated_at=now() WHERE user_id=$${params.length}`, params);
}

export interface RatingChangeResult { previousRating: number; newRating: number; }
/**
 * Applies a rating delta to the player's global standing (league_rating).
 * The Standard/Great/Ultra/Master league tiers are on hold for now -- this only
 * moves the raw number the leaderboard ranks on, it does not touch `league`.
 */
export async function applyRatingChange(userId: string, ratingDelta: number): Promise<RatingChangeResult> {
  return transaction(async client => {
    const row = (await client.query('SELECT league_rating FROM brawl_profiles WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
    const previousRating = Number(row?.league_rating ?? 1000);
    const newRating = Math.max(0, previousRating + ratingDelta);
    await client.query('UPDATE brawl_profiles SET league_rating=$1, updated_at=now() WHERE user_id=$2', [newRating, userId]);
    return { previousRating, newRating };
  });
}

export async function getWalletBalance(userId: string): Promise<number> {
  const rows = await query<{ balance: string }>('SELECT balance FROM brawl_wallets WHERE user_id=$1', [userId]);
  return rows[0] ? Number(rows[0].balance) : 0;
}

export interface WalletTxnResult { balanceBefore: number; balanceAfter: number; }
/** Earn-only pokedollar ledger, fully separate from users.balance / wallet_transactions. */
export async function applyBrawlWalletTransaction(userId: string, type: string, amount: number, sourceId?: string, metadata: Record<string, unknown> = {}): Promise<WalletTxnResult> {
  return transaction(async client => {
    await client.query('INSERT INTO brawl_wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const walletRow = (await client.query('SELECT balance FROM brawl_wallets WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
    const balanceBefore = Number(walletRow?.balance || 0);
    if (amount < 0 && balanceBefore + amount < 0) throw new Error('INSUFFICIENT_POKEDOLLARS');
    const balanceAfter = balanceBefore + amount;
    await client.query('UPDATE brawl_wallets SET balance=$1, updated_at=now() WHERE user_id=$2', [balanceAfter, userId]);
    await client.query(
      'INSERT INTO brawl_wallet_transactions (id, user_id, type, amount, balance_before, balance_after, source_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [uid(), userId, type, amount, balanceBefore, balanceAfter, sourceId || null, JSON.stringify(metadata)],
    );
    return { balanceBefore, balanceAfter };
  });
}

export interface DailyBonusResult { claimedAt: string; nextClaimAt: string; balanceBefore: number; balanceAfter: number; }
/**
 * Claims the once-per-24h Poke Brawl pokedollar bonus. Cooldown check + wallet
 * credit happen inside one row-locked transaction (rather than reusing
 * applyBrawlWalletTransaction's own transaction) so two concurrent requests
 * can't both slip past the cooldown check and double-claim.
 */
export async function claimDailyBonus(userId: string, amount: number): Promise<DailyBonusResult> {
  return transaction(async client => {
    await client.query('INSERT INTO brawl_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const profileRow = (await client.query('SELECT daily_bonus_claimed_at FROM brawl_profiles WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
    const last = profileRow?.daily_bonus_claimed_at ? new Date(profileRow.daily_bonus_claimed_at).getTime() : 0;
    if (Date.now() - last < DAILY_BONUS_COOLDOWN_MS) throw new Error('DAILY_BONUS_ON_COOLDOWN');

    const now = new Date();
    await client.query('UPDATE brawl_profiles SET daily_bonus_claimed_at=$1, updated_at=now() WHERE user_id=$2', [now, userId]);

    await client.query('INSERT INTO brawl_wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const walletRow = (await client.query('SELECT balance FROM brawl_wallets WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
    const balanceBefore = Number(walletRow?.balance || 0);
    const balanceAfter = balanceBefore + amount;
    await client.query('UPDATE brawl_wallets SET balance=$1, updated_at=now() WHERE user_id=$2', [balanceAfter, userId]);
    await client.query(
      'INSERT INTO brawl_wallet_transactions (id, user_id, type, amount, balance_before, balance_after, source_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [uid(), userId, 'daily_bonus', amount, balanceBefore, balanceAfter, `daily_bonus:${userId}:${now.toISOString().slice(0, 10)}`, JSON.stringify({})],
    );
    return { claimedAt: now.toISOString(), nextClaimAt: new Date(now.getTime() + DAILY_BONUS_COOLDOWN_MS).toISOString(), balanceBefore, balanceAfter };
  });
}

export interface InstanceRow {
  id: string; user_id: string; species_id: number; nickname: string | null; source: string; is_on_team: number; team_slot: number | null; star_level: number; acquired_at: string;
}
export async function listInstancesForUser(userId: string): Promise<(InstanceRow & SpeciesRow)[]> {
  return query(
    `SELECT i.*, s.name, s.primary_type, s.secondary_type, s.base_hp, s.base_attack, s.base_defense, s.base_sp_attack, s.base_sp_defense, s.base_speed,
            s.overall_rating, s.evolution_stage, s.evolution_chain_id, s.evolves_to, s.is_legendary, s.is_mythical, s.sprite_url, s.artwork_url,
            s.portrait_scale, s.portrait_offset_x, s.portrait_offset_y
     FROM brawl_pokemon_instances i JOIN brawl_pokemon_species s ON s.id = i.species_id
     WHERE i.user_id=$1 ORDER BY i.team_slot NULLS LAST, i.acquired_at`,
    [userId],
  );
}
export async function countInstancesForUser(userId: string): Promise<number> {
  const rows = await query<{ count: string }>('SELECT count(*)::text count FROM brawl_pokemon_instances WHERE user_id=$1', [userId]);
  return Number(rows[0]?.count || 0);
}
export async function insertInstances(userId: string, speciesIds: number[], source: string, client?: PoolClient): Promise<string[]> {
  const runner = client ? (sql: string, p: unknown[]) => client.query(sql, p) : (sql: string, p: unknown[]) => query(sql, p);
  const ids: string[] = [];
  for (const speciesId of speciesIds) {
    const id = uid();
    ids.push(id);
    await runner('INSERT INTO brawl_pokemon_instances (id, user_id, species_id, source) VALUES ($1,$2,$3,$4)', [id, userId, speciesId, source]);
  }
  return ids;
}
export async function setTeam(userId: string, instanceIds: string[]): Promise<void> {
  await transaction(async client => {
    const owned = (await client.query('SELECT id FROM brawl_pokemon_instances WHERE user_id=$1 AND id = ANY($2)', [userId, instanceIds])).rows;
    if (owned.length !== instanceIds.length) throw new Error('INVALID_TEAM_SELECTION');
    await client.query('UPDATE brawl_pokemon_instances SET is_on_team=0, team_slot=NULL WHERE user_id=$1', [userId]);
    for (let i = 0; i < instanceIds.length; i++) {
      await client.query('UPDATE brawl_pokemon_instances SET is_on_team=1, team_slot=$1 WHERE id=$2 AND user_id=$3', [i + 1, instanceIds[i], userId]);
    }
  });
}

// Duplicate-merge economy: 3 copies of a basic (stage 1) species merge into
// its next evolution; 5 copies of anything past that (2nd stage, or a fully
// evolved / single-stage species) merge into either the next evolution or --
// once there's nowhere left to evolve -- a star level. Mirrors the real
// games' loose "it gets easier early, costlier later" evolution cadence
// without trying to model per-species candy costs.
export const EVOLVE_COST_STAGE_1 = 3;
export const EVOLVE_COST_STAGE_2_PLUS = 5;
// A star upgrade costs 5 copies *total* at every level ("5 Charizards merge
// into a 1-star, another 5 into a 2-star"): one of those 5 is the instance
// being upgraded (it survives, keeping its star progress), so only 4 more
// need to be freshly spent alongside it.
export const STAR_UPGRADE_FODDER_COUNT = 4;
export const MAX_STAR_LEVEL = 3;

export function evolveCostForStage(stage: number): number {
  return stage <= 1 ? EVOLVE_COST_STAGE_1 : EVOLVE_COST_STAGE_2_PLUS;
}

export interface EvolveResult { newInstanceId: string; }
/**
 * Consumes `instanceIds` copies of `sourceSpeciesId` and creates one instance
 * of `targetSpeciesId`. Every fodder instance must: belong to the caller,
 * actually be that species, be off the active team (protects a player's
 * lineup from an accidental/careless merge), and be un-starred (evolving
 * shouldn't be a backdoor way to erase a star investment someone already
 * made in that specific copy).
 */
export async function evolveInstances(userId: string, sourceSpeciesId: number, targetSpeciesId: number, instanceIds: string[]): Promise<EvolveResult> {
  return transaction(async client => {
    const species = (await client.query('SELECT evolution_stage, evolves_to FROM brawl_pokemon_species WHERE id=$1', [sourceSpeciesId])).rows[0];
    if (!species) throw new Error('SPECIES_NOT_FOUND');
    if (!(species.evolves_to as number[] || []).includes(targetSpeciesId)) throw new Error('INVALID_EVOLUTION_TARGET');

    const required = evolveCostForStage(species.evolution_stage);
    const uniqueIds = Array.from(new Set(instanceIds));
    if (uniqueIds.length !== required) throw new Error('WRONG_INSTANCE_COUNT');

    const owned = (await client.query(
      'SELECT id, species_id, is_on_team, star_level FROM brawl_pokemon_instances WHERE user_id=$1 AND id = ANY($2) FOR UPDATE',
      [userId, uniqueIds],
    )).rows;
    if (owned.length !== required) throw new Error('INSTANCES_NOT_FOUND');
    if (owned.some(r => r.species_id !== sourceSpeciesId)) throw new Error('SPECIES_MISMATCH');
    if (owned.some(r => r.is_on_team)) throw new Error('INSTANCE_ON_TEAM');
    if (owned.some(r => r.star_level > 0)) throw new Error('INSTANCE_HAS_STARS');

    await client.query('DELETE FROM brawl_pokemon_instances WHERE id = ANY($1)', [uniqueIds]);
    const newInstanceId = uid();
    await client.query('INSERT INTO brawl_pokemon_instances (id, user_id, species_id, source) VALUES ($1,$2,$3,$4)', [newInstanceId, userId, targetSpeciesId, 'evolved']);
    return { newInstanceId };
  });
}

export interface StarUpgradeResult { newStarLevel: number; }
/**
 * Bumps `targetInstanceId`'s star level by one, consuming 4 other (off-team,
 * un-starred, same-species) instances as fodder -- 5 copies touched in total
 * per level, matching "5 Charizards merge into a 1-star, another 5 into a
 * 2-star". The target itself keeps its identity/nickname/acquired_at -- only
 * star_level changes -- while the 4 fodder copies are deleted outright.
 */
export async function starUpgradeInstance(userId: string, targetInstanceId: string, fodderInstanceIds: string[]): Promise<StarUpgradeResult> {
  return transaction(async client => {
    const uniqueFodder = Array.from(new Set(fodderInstanceIds));
    if (uniqueFodder.length !== STAR_UPGRADE_FODDER_COUNT) throw new Error('WRONG_INSTANCE_COUNT');
    if (uniqueFodder.includes(targetInstanceId)) throw new Error('TARGET_IN_FODDER');

    const target = (await client.query(
      'SELECT id, species_id, is_on_team, star_level FROM brawl_pokemon_instances WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [targetInstanceId, userId],
    )).rows[0];
    if (!target) throw new Error('TARGET_NOT_FOUND');
    if (target.is_on_team) throw new Error('INSTANCE_ON_TEAM');
    if (target.star_level >= MAX_STAR_LEVEL) throw new Error('MAX_STAR_LEVEL');

    const fodder = (await client.query(
      'SELECT id, species_id, is_on_team, star_level FROM brawl_pokemon_instances WHERE user_id=$1 AND id = ANY($2) FOR UPDATE',
      [userId, uniqueFodder],
    )).rows;
    if (fodder.length !== STAR_UPGRADE_FODDER_COUNT) throw new Error('INSTANCES_NOT_FOUND');
    if (fodder.some(r => r.species_id !== target.species_id)) throw new Error('SPECIES_MISMATCH');
    if (fodder.some(r => r.is_on_team)) throw new Error('INSTANCE_ON_TEAM');
    if (fodder.some(r => r.star_level > 0)) throw new Error('INSTANCE_HAS_STARS');

    await client.query('DELETE FROM brawl_pokemon_instances WHERE id = ANY($1)', [uniqueFodder]);
    const newStarLevel = target.star_level + 1;
    await client.query('UPDATE brawl_pokemon_instances SET star_level=$1 WHERE id=$2', [newStarLevel, targetInstanceId]);
    return { newStarLevel };
  });
}

export interface BattleRunRow {
  id: string; user_id: string; tier: string; status: string; entry_cost: number; total_reward: number; matches_won: number; matches_total: number; created_at: string; completed_at: string | null;
}
export async function countRunsToday(userId: string): Promise<number> {
  const rows = await query<{ count: string }>("SELECT count(*)::text count FROM brawl_battle_runs WHERE user_id=$1 AND created_at >= date_trunc('day', now())", [userId]);
  return Number(rows[0]?.count || 0);
}
export async function lastRunForTier(userId: string, tier: string): Promise<BattleRunRow | null> {
  const rows = await query<BattleRunRow>('SELECT * FROM brawl_battle_runs WHERE user_id=$1 AND tier=$2 ORDER BY created_at DESC LIMIT 1', [userId, tier]);
  return rows[0] || null;
}
export async function createRun(userId: string, tier: string, entryCost: number, matchesTotal: number): Promise<BattleRunRow> {
  return (await query<BattleRunRow>(
    'INSERT INTO brawl_battle_runs (id, user_id, tier, entry_cost, matches_total) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [uid(), userId, tier, entryCost, matchesTotal],
  ))[0];
}
export async function addMatch(runId: string, matchIndex: number, opponentSnapshot: unknown, result: 'win' | 'loss', battleLog: unknown): Promise<void> {
  await query(
    'INSERT INTO brawl_battle_matches (id, run_id, match_index, opponent_snapshot, result, battle_log) VALUES ($1,$2,$3,$4,$5,$6)',
    [uid(), runId, matchIndex, JSON.stringify(opponentSnapshot), result, JSON.stringify(battleLog)],
  );
}
export async function completeRun(runId: string, status: 'won' | 'eliminated', matchesWon: number, totalReward: number): Promise<void> {
  await query('UPDATE brawl_battle_runs SET status=$1, matches_won=$2, total_reward=$3, completed_at=now() WHERE id=$4', [status, matchesWon, totalReward, runId]);
}

export async function insertSafariPull(userId: string, tier: number, cost: number, speciesIds: number[]): Promise<void> {
  await query('INSERT INTO brawl_safari_pulls (id, user_id, tier, cost, species_ids) VALUES ($1,$2,$3,$4,$5)', [uid(), userId, tier, cost, speciesIds]);
}

export async function getActiveTeamSpecies(userId: string): Promise<(SpeciesRow & { star_level: number })[]> {
  return query<SpeciesRow & { star_level: number }>(
    `SELECT s.*, i.star_level FROM brawl_pokemon_instances i JOIN brawl_pokemon_species s ON s.id = i.species_id
     WHERE i.user_id=$1 AND i.is_on_team=1 ORDER BY i.team_slot`,
    [userId],
  );
}

export interface LeaderboardRow { user_id: string; username: string | null; avatar_url: string | null; league: string; league_rating: number; wins: number; losses: number; }
export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  return query<LeaderboardRow>(
    `SELECT p.user_id, u.username, u.avatar_url, p.league, p.league_rating, p.wins, p.losses
     FROM brawl_profiles p JOIN users u ON u.id = p.user_id
     ORDER BY p.league_rating DESC, p.wins DESC LIMIT $1`,
    [limit],
  );
}

export interface RankInfo { rank: number; total: number; }
/**
 * Where a trainer sits on the global leaderboard (1-indexed) and how many
 * trainers are ranked in total -- same ordering as getLeaderboard so "Rank 1
 * of 2" always lines up with what the leaderboard table actually shows.
 */
export async function getPlayerRank(userId: string): Promise<RankInfo> {
  const rows = await query<{ rank: string; total: string }>(
    `SELECT rank, total FROM (
       SELECT user_id, ROW_NUMBER() OVER (ORDER BY league_rating DESC, wins DESC) AS rank, COUNT(*) OVER () AS total
       FROM brawl_profiles
     ) ranked WHERE user_id = $1`,
    [userId],
  );
  return { rank: Number(rows[0]?.rank || 1), total: Number(rows[0]?.total || 1) };
}

export interface TrainerProfile {
  userId: string; username: string | null; avatarUrl: string | null;
  leagueRating: number; wins: number; losses: number;
  regionalTournamentWins: number; eliteFourWins: number; challengesCompleted: number;
  team: SpeciesRow[];
}
export async function getTrainerProfile(userId: string): Promise<TrainerProfile | null> {
  const rows = await query<{
    user_id: string; username: string | null; avatar_url: string | null; league_rating: number; wins: number; losses: number;
    regional_tournament_wins: number; elite_four_wins: number;
  }>(
    `SELECT p.user_id, u.username, u.avatar_url, p.league_rating, p.wins, p.losses, p.regional_tournament_wins, p.elite_four_wins
     FROM brawl_profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id=$1`,
    [userId],
  );
  if (!rows[0]) return null;
  const team = await getActiveTeamSpecies(userId);
  return {
    userId: rows[0].user_id, username: rows[0].username, avatarUrl: rows[0].avatar_url,
    leagueRating: rows[0].league_rating, wins: rows[0].wins, losses: rows[0].losses,
    regionalTournamentWins: rows[0].regional_tournament_wins, eliteFourWins: rows[0].elite_four_wins,
    // Challenges/objectives haven't shipped yet (see ChallengesTab's "coming soon"
    // state) -- always 0 until that system exists, not a placeholder for real data.
    challengesCompleted: 0,
    team,
  };
}

// ---- Admin: cross-user visibility + manual adjustment -------------------

export interface AdminUserSummary {
  user_id: string; username: string | null; avatar_url: string | null;
  league_rating: number; wins: number; losses: number; roster_count: string;
}
export async function searchBrawlUsers(search: string, limit = 30): Promise<AdminUserSummary[]> {
  const params: unknown[] = [];
  let where = '';
  if (search.trim()) { params.push(`%${search.trim()}%`); where = `WHERE u.username ILIKE $${params.length} OR u.id = $${params.length}`; }
  params.push(limit);
  return query<AdminUserSummary>(
    `SELECT p.user_id, u.username, u.avatar_url, p.league_rating, p.wins, p.losses,
            (SELECT count(*)::text FROM brawl_pokemon_instances i WHERE i.user_id = p.user_id) roster_count
     FROM brawl_profiles p JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.updated_at DESC LIMIT $${params.length}`,
    params,
  );
}

const PROFILE_ADMIN_EDITABLE_COLUMNS = new Set([
  'has_completed_intro', 'league', 'league_rating', 'wins', 'losses',
  'local_battles_played', 'local_tournament_wins', 'state_tournament_wins', 'regional_tournament_wins', 'elite_four_wins',
]);
/** Directly sets profile fields (not a delta like incrementProfileCounters) -- for admin manual correction. */
export async function adminSetProfileFields(userId: string, fields: Record<string, unknown>): Promise<BrawlProfile> {
  await getOrCreateProfile(userId);
  const entries = Object.entries(fields).filter(([k]) => PROFILE_ADMIN_EDITABLE_COLUMNS.has(k));
  if (!entries.length) return (await query<BrawlProfile>('SELECT * FROM brawl_profiles WHERE user_id=$1', [userId]))[0];
  const sets = entries.map(([k], i) => `${k}=$${i + 1}`).join(',');
  const params: unknown[] = entries.map(([, v]) => v);
  params.push(userId);
  return (await query<BrawlProfile>(`UPDATE brawl_profiles SET ${sets}, updated_at=now() WHERE user_id=$${params.length} RETURNING *`, params))[0];
}

export async function adminDeleteInstance(userId: string, instanceId: string): Promise<boolean> {
  const rows = await query('DELETE FROM brawl_pokemon_instances WHERE id=$1 AND user_id=$2 RETURNING id', [instanceId, userId]);
  return rows.length > 0;
}
