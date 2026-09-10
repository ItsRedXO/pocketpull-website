import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { BATTLE_TIERS, SAFARI_TIERS, DAILY_BATTLE_CAP, type BattleTierId } from '../lib/brawl/tiers';
import { simulateBattle } from '../lib/brawl/battleSim';
import { rollSafariPull } from '../lib/brawl/safariZone';
import {
  getOrCreateProfile, completeIntro, incrementProfileCounters, getWalletBalance, applyBrawlWalletTransaction,
  listInstancesForUser, insertInstances, setTeam, getActiveTeamSpecies, pickRandomSpeciesIds, getSpeciesByIds,
  speciesRowToBattleSpecies, countRunsToday, lastRunForTier, createRun, addMatch, completeRun, insertSafariPull,
  getLeaderboard, type BrawlProfile,
} from '../repositories/brawl';

const app = new Hono();
async function auth(c: any) { try { return await requireAuth(c); } catch (e: any) { if (e.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); } }

function tierUnlocked(profile: BrawlProfile, tierId: BattleTierId): boolean {
  const rule = BATTLE_TIERS[tierId].unlockAfter;
  if (!rule) return true;
  return Number((profile as any)[rule.counter] || 0) >= rule.count;
}

app.get('/brawl/config', async c => c.json({ battleTiers: BATTLE_TIERS, safariTiers: SAFARI_TIERS, dailyBattleCap: DAILY_BATTLE_CAP }));

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
  return c.json({ profile, balance, rosterCount, dailyBattlesUsed, dailyBattleCap: DAILY_BATTLE_CAP, tierStatus });
});

app.post('/brawl/intro/complete', async c => {
  const userId = await auth(c); if (typeof userId !== 'string') return userId;
  const profile = await getOrCreateProfile(userId);
  if (Number(profile.has_completed_intro)) return c.json({ success: true, alreadyCompleted: true });
  const existingCount = (await listInstancesForUser(userId)).length;
  if (existingCount > 0) { await completeIntro(userId); return c.json({ success: true, alreadyCompleted: true }); }
  const starterIds = await pickRandomSpeciesIds(6, { evolutionStage: 1 });
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

app.get('/brawl/leaderboard', async c => c.json({ leaderboard: await getLeaderboard(50) }));

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
  const pool = await query<{ id: number; overall_rating: number }>('SELECT id, overall_rating FROM brawl_pokemon_species');
  const speciesIds = rollSafariPull(tierConfig, pool);
  const instanceIds = await insertInstances(userId, speciesIds, 'safari');
  await insertSafariPull(userId, tierConfig.tier, tierConfig.cost, speciesIds);
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
  const userBattleTeam = activeTeamRows.map(speciesRowToBattleSpecies);

  if (config.entryCost > 0) {
    try {
      await applyBrawlWalletTransaction(userId, 'tier_entry', -config.entryCost, `entry:${config.id}:${userId}:${Date.now()}`, { tier: config.id });
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_POKEDOLLARS') return c.json({ error: `Not enough pokedollars to enter ${config.label} (costs ${config.entryCost})` }, 400);
      throw e;
    }
  }

  const run = await createRun(userId, config.id, config.entryCost, config.matches);
  const matches: Array<{ index: number; result: 'win' | 'loss'; opponentSpeciesIds: number[]; log: unknown }> = [];
  let matchesWon = 0;

  for (let i = 0; i < config.matches; i++) {
    let opponentIds = await pickRandomSpeciesIds(6, { overallMin: config.opponentOverallMin, overallMax: config.opponentOverallMax });
    if (opponentIds.length < 6) opponentIds = await pickRandomSpeciesIds(6, { overallMin: Math.max(1, config.opponentOverallMin - 15), overallMax: config.opponentOverallMax + 15 });
    const opponentRows = await getSpeciesByIds(opponentIds);
    const opponentBattleTeam = opponentRows.map(speciesRowToBattleSpecies);
    const outcome = simulateBattle(userBattleTeam, opponentBattleTeam);
    const result: 'win' | 'loss' = outcome.winner === 'user' ? 'win' : 'loss';
    await addMatch(run.id, i, { opponentSpeciesIds: opponentIds }, result, outcome.log);
    matches.push({ index: i, result, opponentSpeciesIds: opponentIds, log: outcome.log });
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

  const matchesPlayed = matches.length;
  const counterUpdates: Partial<Record<keyof BrawlProfile, number>> = { wins: matchesWon, losses: matchesPlayed - matchesWon };
  if (config.id === 'local_battle') counterUpdates.local_battles_played = 1;
  else if (status === 'won') (counterUpdates as any)[config.winCounterField] = 1;
  await incrementProfileCounters(userId, counterUpdates);

  const balance = await getWalletBalance(userId);
  return c.json({ success: true, tier: config.id, status, matchesWon, matchesTotal: config.matches, reward, balance, matches });
});

export default app;
