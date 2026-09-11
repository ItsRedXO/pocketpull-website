import { query, transaction } from '../lib/postgres';
import { uid } from '../lib/auth';
import {
  buildChallengeInstance, CHALLENGE_COOLDOWN_MS, CHALLENGE_OPTIONS_COUNT,
  type ChallengeInstance, type ChallengeType, type ChallengeTemplateRow,
} from '../lib/brawl/challenges';
import type { PokeType } from '../lib/brawl/typeChart';
import { insertInstances } from './brawl';

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Draws `count` distinct active templates from the catalog and renders each into a concrete offered challenge. */
async function generateChallengeOptions(count = CHALLENGE_OPTIONS_COUNT): Promise<ChallengeInstance[]> {
  const rows = await query<ChallengeTemplateRow>('SELECT * FROM brawl_challenge_templates WHERE active = true');
  return shuffled(rows).slice(0, count).map(buildChallengeInstance);
}

export interface LastCompletedChallenge {
  label: string;
  reward: ChallengeInstance['reward'];
  pokemon?: { id: number; name: string; artworkUrl: string | null; overallRating: number };
  completedAt: string;
}

interface ChallengeStateRow {
  user_id: string;
  offered: ChallengeInstance[];
  selected: ChallengeInstance | null;
  progress: number;
  next_available_at: string | null;
  last_completed: LastCompletedChallenge | null;
}

async function getOrCreateRow(userId: string): Promise<ChallengeStateRow> {
  const existing = await query<ChallengeStateRow>('SELECT * FROM brawl_challenge_state WHERE user_id=$1', [userId]);
  if (existing[0]) return existing[0];
  return (await query<ChallengeStateRow>(
    'INSERT INTO brawl_challenge_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *',
    [userId],
  ))[0];
}

export interface ChallengeStatus {
  status: 'select' | 'active' | 'cooldown';
  offered: ChallengeInstance[];
  active: (ChallengeInstance & { progress: number }) | null;
  cooldownEndsAt: string | null;
  lastCompleted: LastCompletedChallenge | null;
}

/**
 * Derives the player's current challenge state, lazily generating a fresh
 * set of 3 offers the first time they land here with nothing selected and no
 * cooldown pending (covers both brand-new players and the moment a cooldown
 * expires -- there's no background job, this just fills in on read).
 */
export async function getChallengeStatus(userId: string): Promise<ChallengeStatus> {
  let row = await getOrCreateRow(userId);
  if (row.selected) {
    return { status: 'active', offered: [], active: { ...row.selected, progress: row.progress }, cooldownEndsAt: null, lastCompleted: row.last_completed };
  }
  const onCooldown = !!row.next_available_at && new Date(row.next_available_at).getTime() > Date.now();
  if (onCooldown) {
    return { status: 'cooldown', offered: [], active: null, cooldownEndsAt: row.next_available_at, lastCompleted: row.last_completed };
  }
  if (!row.offered || row.offered.length === 0) {
    const offered = await generateChallengeOptions();
    await query('UPDATE brawl_challenge_state SET offered=$1, next_available_at=NULL, updated_at=now() WHERE user_id=$2', [JSON.stringify(offered), userId]);
    row = { ...row, offered, next_available_at: null };
  }
  return { status: 'select', offered: row.offered, active: null, cooldownEndsAt: null, lastCompleted: row.last_completed };
}

export async function selectChallenge(userId: string, challengeId: string): Promise<ChallengeInstance> {
  return transaction(async client => {
    const rows = (await client.query('SELECT * FROM brawl_challenge_state WHERE user_id=$1 FOR UPDATE', [userId])).rows;
    const row = rows[0];
    if (!row) throw new Error('NO_CHALLENGE_STATE');
    if (row.selected) throw new Error('ALREADY_SELECTED');
    if (row.next_available_at && new Date(row.next_available_at).getTime() > Date.now()) throw new Error('ON_COOLDOWN');
    const offered: ChallengeInstance[] = row.offered || [];
    const chosen = offered.find(c => c.id === challengeId);
    if (!chosen) throw new Error('INVALID_CHALLENGE');
    await client.query(
      'UPDATE brawl_challenge_state SET selected=$1, offered=$2, progress=0, updated_at=now() WHERE user_id=$3',
      [JSON.stringify(chosen), JSON.stringify([]), userId],
    );
    return chosen;
  });
}

export interface ChallengeAdvanceResult {
  readyToClaim: boolean;
  progress: number;
  target: number;
  label: string;
}

/**
 * Bumps progress on the player's locked-in challenge by 1 if `type` (and, for
 * win_mono_type, the team's shared type) matches it. No-ops silently if the
 * player has no active challenge or it's a different type -- callers fire
 * this off after every win/evolve/safari-pull without needing to know
 * whether it was relevant. Progress caps at the target but does NOT grant
 * the reward itself -- the player has to visit the Challenges tab and hit
 * Claim (see claimChallenge) so completion actually feels like something.
 */
export async function advanceChallenge(userId: string, type: ChallengeType, opts: { teamType?: PokeType } = {}): Promise<ChallengeAdvanceResult | null> {
  return transaction(async client => {
    const rows = (await client.query('SELECT * FROM brawl_challenge_state WHERE user_id=$1 FOR UPDATE', [userId])).rows;
    const row = rows[0];
    if (!row || !row.selected) return null;
    const challenge: ChallengeInstance = row.selected;
    if (challenge.type !== type) return null;
    if (type === 'win_mono_type' && challenge.meta?.type && challenge.meta.type !== opts.teamType) return null;

    const progress = Math.min(challenge.target, Number(row.progress) + 1);
    await client.query('UPDATE brawl_challenge_state SET progress=$1, updated_at=now() WHERE user_id=$2', [progress, userId]);
    return { readyToClaim: progress >= challenge.target, progress, target: challenge.target, label: challenge.label };
  });
}

export interface ChallengeClaimResult {
  label: string;
  reward: ChallengeInstance['reward'];
  pokemon?: LastCompletedChallenge['pokemon'];
}

/**
 * Grants the reward for the player's locked-in challenge and starts the 15
 * minute cooldown for the next set of 3 offers. Only succeeds once progress
 * has actually hit the target (set by advanceChallenge) -- this is the only
 * place a reward is ever granted, and it only runs when the player
 * explicitly clicks Claim.
 */
export async function claimChallenge(userId: string): Promise<ChallengeClaimResult> {
  return transaction(async client => {
    const rows = (await client.query('SELECT * FROM brawl_challenge_state WHERE user_id=$1 FOR UPDATE', [userId])).rows;
    const row = rows[0];
    if (!row || !row.selected) throw new Error('NO_ACTIVE_CHALLENGE');
    const challenge: ChallengeInstance = row.selected;
    if (Number(row.progress) < challenge.target) throw new Error('NOT_READY');

    let lastCompleted: LastCompletedChallenge = { label: challenge.label, reward: challenge.reward, completedAt: new Date().toISOString() };
    if (challenge.reward.kind === 'pokedollars') {
      await client.query('INSERT INTO brawl_wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [userId]);
      const walletRow = (await client.query('SELECT balance FROM brawl_wallets WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
      const balanceBefore = Number(walletRow?.balance || 0);
      const balanceAfter = balanceBefore + challenge.reward.amount;
      await client.query('UPDATE brawl_wallets SET balance=$1, updated_at=now() WHERE user_id=$2', [balanceAfter, userId]);
      await client.query(
        'INSERT INTO brawl_wallet_transactions (id, user_id, type, amount, balance_before, balance_after, source_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [uid(), userId, 'challenge_reward', challenge.reward.amount, balanceBefore, balanceAfter, `challenge:${challenge.id}`, JSON.stringify({ challengeKey: challenge.templateKey })],
      );
    } else {
      const { overallMin, overallMax } = challenge.reward;
      const picked = (await client.query(
        'SELECT id, name, artwork_url, overall_rating FROM brawl_pokemon_species WHERE overall_rating >= $1 AND overall_rating <= $2 ORDER BY random() LIMIT 1',
        [overallMin, overallMax],
      )).rows[0] || (await client.query(
        'SELECT id, name, artwork_url, overall_rating FROM brawl_pokemon_species ORDER BY abs(overall_rating - $1) LIMIT 1',
        [(overallMin + overallMax) / 2],
      )).rows[0];
      await insertInstances(userId, [picked.id], 'challenge', client);
      lastCompleted.pokemon = { id: picked.id, name: picked.name, artworkUrl: picked.artwork_url, overallRating: picked.overall_rating };
    }

    const nextAvailableAt = new Date(Date.now() + CHALLENGE_COOLDOWN_MS).toISOString();
    await client.query(
      'UPDATE brawl_challenge_state SET selected=NULL, offered=$1, progress=0, next_available_at=$2, last_completed=$3, updated_at=now() WHERE user_id=$4',
      [JSON.stringify([]), nextAvailableAt, JSON.stringify(lastCompleted), userId],
    );
    return { label: challenge.label, reward: challenge.reward, pokemon: lastCompleted.pokemon };
  });
}

// ---- Admin: challenge template CRUD --------------------------------------
// Deleting/editing a template never touches challenges already offered or
// locked in for a player -- those are rendered ChallengeInstance snapshots
// stored as jsonb on brawl_challenge_state, not references back to this row.

export async function adminListChallengeTemplates(): Promise<ChallengeTemplateRow[]> {
  return query<ChallengeTemplateRow>('SELECT * FROM brawl_challenge_templates ORDER BY type, key');
}

export async function adminCreateChallengeTemplate(fields: Record<string, unknown>): Promise<ChallengeTemplateRow> {
  return (await query<ChallengeTemplateRow>(
    `INSERT INTO brawl_challenge_templates (key, type, label, description, target, reward_kind, reward_amount, reward_overall_min, reward_overall_max, fixed_type, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      fields.key, fields.type, fields.label, fields.description, fields.target, fields.reward_kind,
      fields.reward_amount ?? null, fields.reward_overall_min ?? null, fields.reward_overall_max ?? null,
      fields.fixed_type || null, !!fields.active,
    ],
  ))[0];
}

const CHALLENGE_TEMPLATE_EDITABLE_FIELDS = new Set([
  'type', 'label', 'description', 'target', 'reward_kind', 'reward_amount', 'reward_overall_min', 'reward_overall_max', 'fixed_type', 'active',
]);
export async function adminUpdateChallengeTemplate(key: string, fields: Record<string, unknown>): Promise<ChallengeTemplateRow | null> {
  const entries = Object.entries(fields).filter(([k]) => CHALLENGE_TEMPLATE_EDITABLE_FIELDS.has(k));
  if (!entries.length) return (await query<ChallengeTemplateRow>('SELECT * FROM brawl_challenge_templates WHERE key=$1', [key]))[0] || null;
  const sets = entries.map(([k], i) => `${k}=$${i + 1}`).join(',');
  const params: unknown[] = entries.map(([, v]) => v);
  params.push(key);
  return (await query<ChallengeTemplateRow>(`UPDATE brawl_challenge_templates SET ${sets}, updated_at=now() WHERE key=$${params.length} RETURNING *`, params))[0] || null;
}

export async function adminDeleteChallengeTemplate(key: string): Promise<void> {
  await query('DELETE FROM brawl_challenge_templates WHERE key=$1', [key]);
}
