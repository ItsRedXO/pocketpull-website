import { query, transaction } from '../lib/postgres';
import { uid } from '../lib/auth';
import { generateChallengeOptions, CHALLENGE_COOLDOWN_MS, type ChallengeInstance, type ChallengeType } from '../lib/brawl/challenges';
import type { PokeType } from '../lib/brawl/typeChart';
import { insertInstances } from './brawl';

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
    const offered = generateChallengeOptions();
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
  completed: boolean;
  progress: number;
  target: number;
  label: string;
  reward?: ChallengeInstance['reward'];
}

/**
 * Bumps progress on the player's locked-in challenge by 1 if `type` (and, for
 * win_mono_type, the team's shared type) matches it. No-ops silently if the
 * player has no active challenge or it's a different type -- callers fire
 * this off after every win/evolve/safari-pull without needing to know
 * whether it was relevant. On hitting target, grants the reward and starts
 * the 15 minute cooldown for the next set of 3 offers, all in one
 * transaction so the reward can never be granted without the challenge
 * actually clearing (or vice versa).
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
    if (progress < challenge.target) {
      await client.query('UPDATE brawl_challenge_state SET progress=$1, updated_at=now() WHERE user_id=$2', [progress, userId]);
      return { completed: false, progress, target: challenge.target, label: challenge.label };
    }

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
    return { completed: true, progress, target: challenge.target, label: challenge.label, reward: challenge.reward };
  });
}
