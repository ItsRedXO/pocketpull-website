import type { PoolClient } from 'pg';
import { query, transaction } from '../lib/postgres';
import { uid } from '../lib/auth';
import type { BattleSpecies } from '../lib/brawl/battleSim';
import type { PokeType } from '../lib/brawl/typeChart';

export interface SpeciesRow {
  id: number; name: string; primary_type: string; secondary_type: string | null;
  base_hp: number; base_attack: number; base_defense: number; base_sp_attack: number; base_sp_defense: number; base_speed: number;
  overall_rating: number; evolution_stage: number; evolution_chain_id: number;
  is_legendary: number; is_mythical: number; sprite_url: string | null; artwork_url: string | null;
}

export function speciesRowToBattleSpecies(row: SpeciesRow): BattleSpecies {
  return {
    speciesId: row.id, name: row.name, primaryType: row.primary_type as PokeType, secondaryType: row.secondary_type as PokeType | null,
    baseHp: row.base_hp, attack: row.base_attack, defense: row.base_defense, spAttack: row.base_sp_attack, spDefense: row.base_sp_defense,
    speed: row.base_speed, overall: row.overall_rating, spriteUrl: row.sprite_url, artworkUrl: row.artwork_url,
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

const SPECIES_EDITABLE_COLUMNS = new Set(['name', 'primary_type', 'secondary_type', 'base_hp', 'base_attack', 'base_defense', 'base_sp_attack', 'base_sp_defense', 'base_speed', 'overall_rating', 'sprite_url', 'artwork_url']);
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

export interface InstanceRow {
  id: string; user_id: string; species_id: number; nickname: string | null; source: string; is_on_team: number; team_slot: number | null; acquired_at: string;
}
export async function listInstancesForUser(userId: string): Promise<(InstanceRow & SpeciesRow)[]> {
  return query(
    `SELECT i.*, s.name, s.primary_type, s.secondary_type, s.base_hp, s.base_attack, s.base_defense, s.base_sp_attack, s.base_sp_defense, s.base_speed,
            s.overall_rating, s.evolution_stage, s.sprite_url, s.artwork_url
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

export async function getActiveTeamSpecies(userId: string): Promise<SpeciesRow[]> {
  return query<SpeciesRow>(
    `SELECT s.* FROM brawl_pokemon_instances i JOIN brawl_pokemon_species s ON s.id = i.species_id
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
