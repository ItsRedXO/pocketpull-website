import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { BATTLE_TIERS, SAFARI_TIERS, DAILY_BATTLE_CAP, DAILY_BONUS_AMOUNT, DAILY_BONUS_COOLDOWN_MS, type BattleTierId } from '../lib/brawl/tiers';
import { TIER_RATING_DELTA } from '../lib/brawl/leagues';
import { simulateBattle } from '../lib/brawl/battleSim';
import type { PokeType } from '../lib/brawl/typeChart';
import { rollSafariPull } from '../lib/brawl/safariZone';
import {
  getOrCreateProfile, completeIntro, incrementProfileCounters, getWalletBalance, applyBrawlWalletTransaction,
  listInstancesForUser, insertInstances, setTeam, getActiveTeamSpecies, pickRandomSpeciesIds, getSpeciesByIds, listAllSpecies,
  speciesRowToBattleSpecies, applyStarBonus, countRunsToday, lastRunForTier, createRun, addMatch, completeRun, insertSafariPull,
  getLeaderboard, getPlayerRank, applyRatingChange, getTrainerProfile, claimDailyBonus,
  evolveInstances, starUpgradeInstance, type BrawlProfile,
} from '../repositories/brawl';
import { getChallengeStatus, selectChallenge, advanceChallenge, claimChallenge } from '../repositories/brawlChallenges';

// Starter packs are deliberately weaker than the general species pool (28-38
// overall -- real basic-stage Pokemon top out around 36-37 post-rescale, see
// scaleBaseStat in rating.ts) so a first-time player's team is an "average"
// starting roster they work up from, rather than getting lucky/unlucky into
// something wildly uneven.
const STARTER_OVERALL_MIN = 28;
const STARTER_OVERALL_MAX = 38;

const app = new Hono();
async function auth(c: any) { try { return await requireAuth(c); } catch (e: any) { if (e.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); } }

function tierUnlocked(profile: BrawlProfile, tierId: BattleTierId): boolean {
  const rule = BATTLE_TIERS[tierId].unlockAfter;
  if (!rule) return true;
  return Number((profile as any)[rule.counter] || 0) >= rule.count;
}

app.get('/brawl/config', async c => c.json({ battleTiers: BATTLE_TIERS, safariTiers: SAFARI_TIERS, dailyBattleCap: DAILY_BATTLE_CAP, tierRatingDeltas: TIER_RATING_DELTA }));

// Full species catalog (not just what the player owns) -- the merge/evolve UI
// needs to show the name/art of an evolution target the player doesn't have
// a copy of yet.
app.get('/brawl/species', async c => c.json({ species: await listAllSpecies() }));

app.get('/brawl/profile', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const profile = await getOrCreateProfile(userId);
  const balance = await getWalletBalance(userId);
  const rosterCount = (await listInstancesForUser(userId)).length;
  const dailyBattlesUsed = await countRunsToday(userId);
  const tierStatus: Record<string, { unlocked: boolean; cooldownEndsAt: string | null }> = {};
  for (const tierId of Object.keys(BATTLE_TIERS) as BattleTierId[]) {
    const config = BATTLE_TIERS[tierId];
    const unlocked = tierUnlocked(profile, tierId);
    let cooldownEndsAt: string | null = null;
    if (config.cooldownMs > 0) {
      const last = await lastRunForTier(userId, tierId);
      if (last) {
        const endsAt = new Date(last.created_at).getTime() + config.cooldownMs;
        if (endsAt > Date.now()) cooldownEndsAt = new Date(endsAt).toISOString();
      }
    }
    tierStatus[tierId] = { unlocked, cooldownEndsAt };
  }
  let dailyBonusNextClaimAt: string | null = null;
  if (profile.daily_bonus_claimed_at) {
    const endsAt = new Date(profile.daily_bonus_claimed_at).getTime() + DAILY_BONUS_COOLDOWN_MS;
    if (endsAt > Date.now()) dailyBonusNextClaimAt = new Date(endsAt).toISOString();
  }
  const dailyBonus = { amount: DAILY_BONUS_AMOUNT, claimable: !dailyBonusNextClaimAt, nextClaimAt: dailyBonusNextClaimAt };
  const rank = await getPlayerRank(userId);
  return c.json({ profile, balance, rosterCount, dailyBattlesUsed, dailyBattleCap: DAILY_BATTLE_CAP, tierStatus, dailyBonus, rank });
});

app.post('/brawl/daily-bonus/claim', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  try {
    const result = await claimDailyBonus(userId, DAILY_BONUS_AMOUNT);
    return c.json({ success: true, amount: DAILY_BONUS_AMOUNT, claimedAt: result.claimedAt, nextClaimAt: result.nextClaimAt, balance: result.balanceAfter });
  } catch (e: any) {
    if (e.message === 'DAILY_BONUS_ON_COOLDOWN') {
      const profile = await getOrCreateProfile(userId);
      const endsAt = new Date(profile.daily_bonus_claimed_at!).getTime() + DAILY_BONUS_COOLDOWN_MS;
      return c.json({ error: 'Daily bonus already claimed', nextClaimAt: new Date(endsAt).toISOString() }, 429);
    }
    throw e;
  }
});

app.post('/brawl/intro/complete', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const profile = await getOrCreateProfile(userId);
  if (Number(profile.has_completed_intro)) return c.json({ success: true, alreadyCompleted: true });
  const existingCount = (await listInstancesForUser(userId)).length;
  if (existingCount > 0) { await completeIntro(userId); return c.json({ success: true, alreadyCompleted: true }); }
  let starterIds = await pickRandomSpeciesIds(6, { evolutionStage: 1, overallMin: STARTER_OVERALL_MIN, overallMax: STARTER_OVERALL_MAX });
  if (starterIds.length < 6) starterIds = await pickRandomSpeciesIds(6, { evolutionStage: 1 });
  if (starterIds.length < 6) return c.json({ error: 'Starter pool unavailable, try again shortly' }, 503);
  const instanceIds = await insertInstances(userId, starterIds, 'starter');
  await setTeam(userId, instanceIds);
  await completeIntro(userId);
  const roster = await listInstancesForUser(userId);
  return c.json({ success: true, roster });
});

app.get('/brawl/roster', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  return c.json({ roster: await listInstancesForUser(userId) });
});

app.post('/brawl/team', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { instanceIds } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(instanceIds) || instanceIds.length < 1 || instanceIds.length > 6) return c.json({ error: 'Select 1-6 Pokemon for your active team' }, 400);
  try { await setTeam(userId, instanceIds); } catch (e: any) { return c.json({ error: e.message === 'INVALID_TEAM_SELECTION' ? 'One or more selected Pokemon are not in your roster' : 'Failed to update team' }, 400); }
  return c.json({ success: true, roster: await listInstancesForUser(userId) });
});

const EVOLVE_ERROR_MESSAGES: Record<string, string> = {
  SPECIES_NOT_FOUND: 'Unknown species',
  INVALID_EVOLUTION_TARGET: "That Pokemon doesn't evolve into your target species",
  WRONG_INSTANCE_COUNT: 'Wrong number of Pokemon selected for this evolution',
  INSTANCES_NOT_FOUND: 'One or more selected Pokemon were not found in your roster',
  SPECIES_MISMATCH: 'All selected Pokemon must be the same species',
  INSTANCE_ON_TEAM: 'Remove those Pokemon from your active team before merging them',
  INSTANCE_HAS_STARS: 'Starred Pokemon can\'t be used as evolution fodder',
};
app.post('/brawl/roster/evolve', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { sourceSpeciesId, targetSpeciesId, instanceIds } = await c.req.json().catch(() => ({}));
  if (!Number.isInteger(sourceSpeciesId) || !Number.isInteger(targetSpeciesId) || !Array.isArray(instanceIds)) {
    return c.json({ error: 'Invalid request' }, 400);
  }
  try {
    const result = await evolveInstances(userId, sourceSpeciesId, targetSpeciesId, instanceIds);
    await advanceChallenge(userId, 'evolve_pokemon');
    return c.json({ success: true, newInstanceId: result.newInstanceId, roster: await listInstancesForUser(userId) });
  } catch (e: any) {
    return c.json({ error: EVOLVE_ERROR_MESSAGES[e.message] || 'Evolution failed' }, 400);
  }
});

app.post('/brawl/roster/star-upgrade', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { targetInstanceId, fodderInstanceIds } = await c.req.json().catch(() => ({}));
  if (typeof targetInstanceId !== 'string' || !Array.isArray(fodderInstanceIds)) return c.json({ error: 'Invalid request' }, 400);
  try {
    const result = await starUpgradeInstance(userId, targetInstanceId, fodderInstanceIds);
    return c.json({ success: true, newStarLevel: result.newStarLevel, roster: await listInstancesForUser(userId) });
  } catch (e: any) {
    const messages: Record<string, string> = {
      ...EVOLVE_ERROR_MESSAGES,
      TARGET_IN_FODDER: "The Pokemon being upgraded can't also be one of the 5 fodder Pokemon",
      TARGET_NOT_FOUND: 'Pokemon not found in your roster',
      MAX_STAR_LEVEL: 'That Pokemon is already at the max star level',
    };
    return c.json({ error: messages[e.message] || 'Star upgrade failed' }, 400);
  }
});

app.get('/brawl/challenges', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  return c.json(await getChallengeStatus(userId));
});

app.post('/brawl/challenges/select', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { challengeId } = await c.req.json().catch(() => ({}));
  if (typeof challengeId !== 'string') return c.json({ error: 'Invalid request' }, 400);
  try {
    const active = await selectChallenge(userId, challengeId);
    return c.json({ success: true, active: { ...active, progress: 0 } });
  } catch (e: any) {
    const messages: Record<string, string> = {
      NO_CHALLENGE_STATE: 'Challenges not available yet, try again shortly',
      ALREADY_SELECTED: 'You already have a challenge locked in',
      ON_COOLDOWN: 'New challenges are still on cooldown',
      INVALID_CHALLENGE: 'That challenge is no longer available',
    };
    return c.json({ error: messages[e.message] || 'Failed to select challenge' }, 400);
  }
});

app.post('/brawl/challenges/claim', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  try {
    const result = await claimChallenge(userId);
    const balance = await getWalletBalance(userId);
    return c.json({ success: true, label: result.label, reward: result.reward, pokemon: result.pokemon, balance });
  } catch (e: any) {
    const messages: Record<string, string> = {
      NO_ACTIVE_CHALLENGE: 'No challenge locked in',
      NOT_READY: "That challenge isn't complete yet",
    };
    return c.json({ error: messages[e.message] || 'Failed to claim challenge' }, 400);
  }
});

app.get('/brawl/leaderboard', async c => c.json({ leaderboard: await getLeaderboard(100) }));

app.get('/brawl/trainer/:userId', async c => {
  const trainer = await getTrainerProfile(c.req.param('userId'));
  if (!trainer) return c.json({ error: 'Trainer not found' }, 404);
  return c.json({ trainer });
});

app.post('/brawl/safari/pull', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { tier } = await c.req.json().catch(() => ({}));
  const tierConfig = SAFARI_TIERS.find(t => t.tier === Number(tier));
  if (!tierConfig) return c.json({ error: 'Invalid Safari Zone tier' }, 400);
  try {
    await applyBrawlWalletTransaction(userId, 'safari_pull', -tierConfig.cost, `safari:${userId}:${Date.now()}`, { tier: tierConfig.tier });
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_POKEDOLLARS') return c.json({ error: 'Not enough pokedollars for this Safari Zone tier' }, 400);
    throw e;
  }
  const pool = await query<{ id: number; overall_rating: number; evolution_stage: number; is_legendary: number; is_mythical: number }>(
    'SELECT id, overall_rating, evolution_stage, is_legendary, is_mythical FROM brawl_pokemon_species',
  );
  const speciesIds = rollSafariPull(tierConfig, pool);
  const instanceIds = await insertInstances(userId, speciesIds, 'safari');
  await insertSafariPull(userId, tierConfig.tier, tierConfig.cost, speciesIds);
  await advanceChallenge(userId, 'open_safari');
  const pulled = await getSpeciesByIds(speciesIds);
  const balance = await getWalletBalance(userId);
  return c.json({ success: true, pulled, instanceIds, balance });
});

app.post('/brawl/battle/play', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const { tier } = await c.req.json().catch(() => ({}));
  const config = BATTLE_TIERS[tier as BattleTierId];
  if (!config) return c.json({ error: 'Invalid battle tier' }, 400);

  const profile = await getOrCreateProfile(userId);
  if (!tierUnlocked(profile, config.id)) return c.json({ error: `${config.label} is still locked` }, 403);

  if (config.cooldownMs > 0) {
    const last = await lastRunForTier(userId, config.id);
    if (last) {
      const endsAt = new Date(last.created_at).getTime() + config.cooldownMs;
      if (endsAt > Date.now()) return c.json({ error: `${config.label} is on cooldown`, cooldownEndsAt: new Date(endsAt).toISOString() }, 429);
    }
  }

  const dailyCount = await countRunsToday(userId);
  if (dailyCount >= DAILY_BATTLE_CAP) return c.json({ error: `Daily battle limit reached (${DAILY_BATTLE_CAP}/day). Resets at midnight UTC.` }, 429);

  const activeTeamRows = await getActiveTeamSpecies(userId);
  if (activeTeamRows.length !== 6) return c.json({ error: 'Set a full 6-Pokemon active team before battling' }, 400);
  const userBattleTeam = activeTeamRows.map(row => applyStarBonus(speciesRowToBattleSpecies(row), row.star_level));

  if (config.entryCost > 0) {
    try {
      await applyBrawlWalletTransaction(userId, 'tier_entry', -config.entryCost, `entry:${config.id}:${userId}:${Date.now()}`, { tier: config.id });
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_POKEDOLLARS') return c.json({ error: `Not enough pokedollars to enter ${config.label} (costs ${config.entryCost})` }, 400);
      throw e;
    }
  }

  const run = await createRun(userId, config.id, config.entryCost, config.matches);
  const matches: Array<{ index: number; result: 'win' | 'loss'; opponentSpeciesIds: number[]; frames: unknown; obstacles: unknown; maxTicks: number }> = [];
  let matchesWon = 0;
  let ratingDelta = 0;
  const tierRatingDelta = TIER_RATING_DELTA[config.id];
  const teamMonoType: PokeType | null = activeTeamRows.every(r => r.primary_type === activeTeamRows[0].primary_type) ? (activeTeamRows[0].primary_type as PokeType) : null;

  for (let i = 0; i < config.matches; i++) {
    let opponentIds = await pickRandomSpeciesIds(6, { overallMin: config.opponentOverallMin, overallMax: config.opponentOverallMax });
    if (opponentIds.length < 6) opponentIds = await pickRandomSpeciesIds(6, { overallMin: Math.max(1, config.opponentOverallMin - 15), overallMax: config.opponentOverallMax + 15 });
    const opponentRows = await getSpeciesByIds(opponentIds);
    const opponentBattleTeam = opponentRows.map(speciesRowToBattleSpecies);
    const outcome = simulateBattle(userBattleTeam, opponentBattleTeam);
    const result: 'win' | 'loss' = outcome.winner === 'user' ? 'win' : 'loss';
    await addMatch(run.id, i, { opponentSpeciesIds: opponentIds }, result, outcome.frames);
    matches.push({ index: i, result, opponentSpeciesIds: opponentIds, frames: outcome.frames, obstacles: outcome.obstacles, maxTicks: outcome.maxTicks });
    ratingDelta += result === 'win' ? tierRatingDelta.win : tierRatingDelta.loss;
    if (result === 'win') {
      await advanceChallenge(userId, 'win_matches');
      if (teamMonoType) await advanceChallenge(userId, 'win_mono_type', { teamType: teamMonoType });
    }
    if (result === 'loss') break;
    matchesWon++;
  }

  const status: 'won' | 'eliminated' = matchesWon === config.matches ? 'won' : 'eliminated';
  let reward = 0;
  if (config.totalReward != null) {
    reward = status === 'won' ? config.totalReward : (matchesWon === 0 ? (config.lossConsolation || 0) : 0);
  } else {
    reward = status === 'won' ? (config.winReward || 0) : (config.lossReward || 0);
  }
  if (reward > 0) await applyBrawlWalletTransaction(userId, 'tier_reward', reward, `reward:${run.id}`, { tier: config.id });
  await completeRun(run.id, status, matchesWon, reward);
  if (status === 'won' && config.id !== 'local_battle') await advanceChallenge(userId, 'win_tournament');

  const matchesPlayed = matches.length;
  const counterUpdates: Partial<Record<keyof BrawlProfile, number>> = { wins: matchesWon, losses: matchesPlayed - matchesWon };
  if (config.id === 'local_battle') counterUpdates.local_battles_played = 1;
  else if (status === 'won') (counterUpdates as any)[config.winCounterField] = 1;
  await incrementProfileCounters(userId, counterUpdates);
  const rating = await applyRatingChange(userId, ratingDelta);

  const balance = await getWalletBalance(userId);
  return c.json({ success: true, tier: config.id, status, matchesWon, matchesTotal: config.matches, reward, balance, matches, rating });
});

export default app;
