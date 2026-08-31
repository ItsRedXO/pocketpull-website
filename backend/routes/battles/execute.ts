import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../../lib/auth';
import { OpenedCard, BattlePullAudit } from './types';
import { rollBotWinChance, determineBattleWinner, distributeCardsShared, getWinnerPool, isExactTie, RARITY_EMOJIS } from './utils';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../../lib/provablyFair';
import { writeLog } from '../logs';
import { processWalletTransaction } from '../../lib/wallet';

const app = new Hono();

function parseBattlePlayers(players: any[]) {
  return players.map(p => ({
    playerId: p.id,
    teamSide: p.teamSide || p.team_side || null,
    userId: p.userId,
    username: p.username,
    avatar: p.avatar,
    isAi: Number(p.isAi || p.is_ai || 0) > 0,
    cards: JSON.parse(p.cardsJson || p.cards_json || '[]'),
    totalValue: Number(p.totalValue || p.total_value || 0),
    isWinner: Number(p.isWinner || p.is_winner || 0) > 0,
  }));
}

/** Reconcile winner flags when a previous concurrent request returned too early. */
async function reconcilePersistedOutcome(blink: any, battle: any, players: any[], battleId: string) {
  const results = parseBattlePlayers(players);
  const mode = battle.mode || 'standard';
  const isTeamBattle = Number(battle.teamMode || battle.team_mode || 0) > 0;
  let winner: any = null;
  let draw = false;
  let winningTeam: 'left' | 'right' | null = null;

  if (mode === 'shared') {
    results.forEach(result => { result.isWinner = true; });
  } else if (isTeamBattle) {
    const left = results.filter(result => result.teamSide === 'left');
    const right = results.filter(result => result.teamSide === 'right');
    const leftTotal = Math.round(left.reduce((sum, result) => sum + result.totalValue, 0) * 100);
    const rightTotal = Math.round(right.reduce((sum, result) => sum + result.totalValue, 0) * 100);
    if (leftTotal === rightTotal) draw = true;
    else {
      winningTeam = leftTotal > rightTotal ? 'left' : 'right';
      results.forEach(result => { result.isWinner = result.teamSide === winningTeam; });
      winner = results.find(result => result.isWinner) || null;
    }
  } else {
    const pool = getWinnerPool(results, null);
    if (isExactTie(pool, mode)) draw = true;
    else {
      winner = determineBattleWinner(pool, mode, null);
      results.forEach(result => { result.isWinner = result.playerId === winner.playerId; });
    }
  }

  // Persist winner flags one row at a time. This is intentionally explicit:
  // updateMany can silently leave mixed boolean payloads unchanged on older
  // database API versions, which made completed wins render as draws later.
  for (const result of results) {
    await blink.db.battlePlayers.update(result.playerId, {
      isWinner: result.isWinner ? 1 : 0,
    });
  }
  await blink.db.battles.update(battleId, {
    winnerUserId: winner?.userId || null,
    winnerUsername: winner?.username || null,
  });
  await awardBattleCards(blink, battleId, mode, draw, isTeamBattle, winningTeam, winner, results);
  return { results, winner, draw };
}

async function awardBattleCards(
  blink: any,
  battleId: string,
  mode: string,
  isDraw: boolean,
  isTeamBattle: boolean,
  winningTeam: 'left' | 'right' | null,
  winnerResult: any,
  playerResults: any[],
) {
  // The battle ID makes this operation idempotent. This repairs battles where
  // player cards were saved but the original inventory insert was interrupted.
  const existing = await blink.db.inventory.list({ where: { battleId }, limit: 1 }) as any[];
  if (existing.length > 0) return;

  const inventoryToCreate: any[] = [];
  const addCard = (card: any, recipient: any) => {
    const recipientId = getRewardUserId(recipient.userId, recipient.isAi);
    inventoryToCreate.push({
      id: `inv_${uid()}`,
      userId: recipientId,
      battleId,
      cardId: `${String(card.name || '').toLowerCase().replace(/\s+/g, '_')}_${card.rarity}`,
      cardName: card.name,
      rarity: card.rarity,
      value: card.value,
      emoji: RARITY_EMOJIS[card.rarity] || '🃏',
      isFavorite: 0,
      cardImageUrl: card.imageUrl || null,
      packName: card.packName,
    });
  };

  if (mode === 'shared' || isDraw) {
    for (const player of playerResults) {
      for (const card of player.cards || []) addCard(card, player);
    }
  } else if (isTeamBattle && winningTeam) {
    const winningPlayers = playerResults.filter(player => player.teamSide === winningTeam);
    const allCards = playerResults.flatMap(player => player.cards || []);
    allCards.forEach((card: any, index: number) => {
      const recipient = winningPlayers[index % winningPlayers.length];
      if (recipient) addCard(card, recipient);
    });
  } else if (winnerResult) {
    for (const card of playerResults.flatMap(player => player.cards || [])) {
      addCard(card, winnerResult);
    }
  }

  if (inventoryToCreate.length > 0) {
    console.log(`[Battle Reward] Creating ${inventoryToCreate.length} inventory items for battle ${battleId}`);
    await blink.db.inventory.createMany(inventoryToCreate);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /battles/execute
// Called by the host client when battle is ready to launch.
//
// Provably Fair: every pack pull — human and bot — uses
// HMAC-SHA256 deterministic rolls. Full audit trail stored in
// battle_pull_audits and packs_opened.
// ──────────────────────────────────────────────────────────────
app.post('/execute', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.hostUserId !== userId) return c.json({ error: 'Only host can execute battle' }, 403);

    // Safety check: if already finished or live, return existing results
    if (battle.status === 'finished' || battle.status === 'live') {
      const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
      const hasCompleteResults = players.length > 0 && players.every(p => {
        const cards = JSON.parse(p.cardsJson || p.cards_json || '[]');
        return cards.length > 0;
      });
      if (hasCompleteResults) {
        console.log(`[battles/execute] Battle ${battleId} already has complete results; reconciling outcome.`);
        const outcome = await reconcilePersistedOutcome(blink, battle, players, battleId);
        return c.json({ success: true, playerResults: outcome.results, winner: outcome.winner, isDraw: outcome.draw });
      }
    }

    if (battle.status !== 'waiting' && battle.status !== 'starting') {
      return c.json({ error: `Battle is in status ${battle.status}` }, 400);
    }

    // ── 0. Provably Fair — validate active server seed ────────────────────
    const serverSeed = c.env.BLINK_SERVER_SEED;
    if (!serverSeed) {
      console.error('[battles/execute] BLINK_SERVER_SEED env var not set');
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }

    const seedRows = await blink.db.serverSeeds.list({
      orderBy: { createdAt: 'desc' },
      limit: 10,
    }) as any[];

    const matchingSeed = seedRows.find((r: any) => r.status === 'active' || r.status === 'pending');
    if (!matchingSeed) {
      console.error('[battles/execute] No active or pending server seed in DB');
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }

    const actualSeedHash = await sha256(serverSeed);
    const matchedRow = seedRows.find(
      (r: any) => (r.status === 'active' || r.status === 'pending') && r.seedHash === actualSeedHash,
    );
    if (!matchedRow) {
      console.error('[battles/execute] CRITICAL: BLINK_SERVER_SEED hash mismatch!');
      return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    }

    // 1. Mark battle live immediately to lock it
    await blink.db.battles.update(battleId, {
      status: 'live',
      startedAt: new Date().toISOString()
    });

    const battlePacks = JSON.parse(battle.packsJson || '[]');
    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];

    // 2. Concurrency safeguard
    const hasCompleteResults = players.length > 0 && players.every(p => {
      const cards = JSON.parse(p.cardsJson || p.cards_json || '[]');
      return cards.length > 0;
    });
    if (hasCompleteResults) {
      console.log(`[battles/execute] Concurrency check: Battle ${battleId} already has complete results.`);
      const outcome = await reconcilePersistedOutcome(blink, battle, players, battleId);
      await blink.db.battles.update(battleId, {
        status: 'finished',
        endedAt: battle.endedAt || new Date().toISOString(),
        isSpinning: 0,
        winnerUserId: outcome.winner?.userId || null,
        winnerUsername: outcome.winner?.username || null,
      });
      return c.json({ success: true, playerResults: outcome.results, winner: outcome.winner, isDraw: outcome.draw });
    }

    // Fetch all pack cards server-side
    const packIds = [...new Set(battlePacks.map((p: any) => p.id))] as string[];
    const allPackCards = await blink.db.packCards.list({
      where: { packId: { in: packIds } },
      limit: 1000
    }) as any[];

    const packCardsMap: Record<string, any[]> = {};
    for (const pid of packIds) {
      packCardsMap[pid] = allPackCards.filter(c => c.packId === pid);
    }

    // ── Build odds snapshots per pack (PF audit) ──────────────────────────
    const packOddsHashes: Record<string, string> = {};
    for (const pid of packIds) {
      const dbCards = packCardsMap[pid] || [];
      if (dbCards.length > 0) {
        const oddsJson = buildOddsSnapshot(dbCards);
        const oddsHash = await sha256(oddsJson);
        packOddsHashes[pid] = oddsHash;
        try {
          await blink.db.table('packOddsVersions').upsert({
            contentHash: oddsHash,
            packId: pid,
            oddsJson,
            cardCount: dbCards.length,
          });
        } catch { /* non-critical */ }
      }
    }

    // ── Open cards for each player (provably fair HMAC-SHA256) ────────────
    const mode = battle.mode || 'standard';

    const playerResults: any[] = [];
    const poLogs: any[] = [];
    const battlePullAudits: BattlePullAudit[] = [];
    let battlePullIndex = 0;

    for (const player of players) {
      const cards: OpenedCard[] = [];
      const isPlayerAi = Number(player.isAi || player.is_ai || 0) > 0;
      const playerUserId = player.userId || player.user_id;

      for (const bPack of battlePacks) {
        battlePullIndex++;
        const dbCards = packCardsMap[bPack.id] || [];
        if (dbCards.length === 0) continue;

        const oddsHash = packOddsHashes[bPack.id] || '';

        // ── Nonce allocation ──────────────────────────────────────────
        let nonce: number;
        if (isPlayerAi) {
          nonce = battlePullIndex;
        } else {
          try {
            await blink.db.sql(
              `INSERT INTO user_nonces (user_id, pack_nonce) VALUES (?, 1)
               ON CONFLICT(user_id) DO UPDATE SET pack_nonce = pack_nonce + 1`,
              [playerUserId]
            );
            const nonceRows = await blink.db.table('userNonces').list({
              where: { userId: playerUserId },
              limit: 1,
            }) as any[];
            if (nonceRows && nonceRows.length > 0) {
              const dbNonce = nonceRows[0].packNonce ?? nonceRows[0].pack_nonce;
              nonce = dbNonce !== undefined && dbNonce !== null ? Number(dbNonce) : battlePullIndex;
            } else {
              nonce = battlePullIndex;
            }
          } catch (nonceErr: any) {
            console.error('[battles/execute] Nonce persistence failed:', nonceErr?.message);
            return c.json({ error: 'Provably fair system error — nonce persistence failed. Please try again.' }, 500);
          }
        }

        // ── Client seed + deterministic roll ──────────────────────────
        const clientSeed = `cs_bt_${uid()}`;
        const rollValue = await computeRoll(serverSeed, clientSeed, nonce);

        // ── Select card deterministically ─────────────────────────────
        const cardIndex = selectCardIndex(rollValue, dbCards);
        const pickedRaw = dbCards[cardIndex] as any;
        const cardRarity = pickedRaw.rarity || 'common';

        const card: OpenedCard & { id: string; emoji?: string } = {
          id: `po_${uid()}`,
          name: pickedRaw.cardName || pickedRaw.card_name || 'Unknown Card',
          rarity: cardRarity,
          value: Number(pickedRaw.estimatedValue ?? pickedRaw.estimated_value ?? 0),
          imageUrl: pickedRaw.cardImageUrl || pickedRaw.card_image_url || null,
          packId: bPack.id,
          packName: bPack.name,
          emoji: RARITY_EMOJIS[cardRarity] || '🃏',
          clientSeed,
          nonce,
          rollValue,
          serverSeedHash: actualSeedHash,
          oddsVersionHash: oddsHash,
          isBot: isPlayerAi,
        };

        // ── packs_opened log for human players (full PF) ──────────────
        if (!isPlayerAi) {
          poLogs.push({
            id: `po_bt_${uid()}`,
            userId: playerUserId,
            packId: bPack.id,
            packName: bPack.name,
            cost: Number(bPack.price),
            cardName: card.name,
            rarity: card.rarity,
            clientSeed,
            nonce,
            rollValue,
            serverSeedHash: actualSeedHash,
            oddsVersionHash: oddsHash,
            provablyFair: 1,
          });
        }

        // ── battle_pull_audits for ALL pulls (human + bot) ────────────
        battlePullAudits.push({
          id: `bpa_${uid()}`,
          battleId,
          battlePlayerId: player.id,
          userId: playerUserId,
          packId: bPack.id,
          packName: bPack.name,
          cardName: card.name,
          rarity: card.rarity,
          cost: Number(bPack.price),
          clientSeed,
          nonce,
          rollValue,
          serverSeedHash: actualSeedHash,
          oddsVersionHash: oddsHash,
          isBot: isPlayerAi ? 1 : 0,
        });

        cards.push(card);
      }

      const total = cards.reduce((s: number, c: any) => s + (c.value ?? 0), 0);
      playerResults.push({
        playerId: player.id,
        teamSide: player.teamSide || player.team_side || null,
        userId: playerUserId,
        username: player.username,
        avatar: player.avatar,
        isAi: isPlayerAi,
        cards,
        totalValue: Math.round(total * 100) / 100,
        isWinner: false,
      });
    }

    // Persist battle pull audits
    try {
      await blink.db.table('battlePullAudits').createMany(battlePullAudits);
    } catch (auditErr: any) {
      console.error('[battles/execute] Failed to persist battle_pull_audits:', auditErr?.message);
    }

    // Batch create packs_opened logs (non-critical)
    if (poLogs.length > 0) {
      blink.db.packsOpened.createMany(poLogs).catch(() => {});
    }

    // ── Determine winner ────────────────────────────────────────────────
    let botFaction: 'bot' | 'human' | null = null;
    let isDraw = false;

    if (mode === 'underdog') {
      const hasBots = playerResults.some(r => r.isAi);
      const hasHumans = playerResults.some(r => !r.isAi);
      if (hasBots && hasHumans) {
        const diceClientSeed = `dice_${battleId}`;
        const diceNonce = battlePullIndex + 1;
        const diceRoll = await computeRoll(serverSeed, diceClientSeed, diceNonce);
        botFaction = rollBotWinChance(playerResults, mode, diceRoll);

        // Audit the dice roll
        battlePullAudits.push({
          id: `bpa_dice_${uid()}`,
          battleId,
          battlePlayerId: 'system',
          userId: 'system',
          packId: 'system',
          packName: '[BATTLE_DICE]',
          cardName: `Underdog dice — faction: ${botFaction}`,
          rarity: 'system',
          cost: 0,
          clientSeed: diceClientSeed,
          nonce: diceNonce,
          rollValue: diceRoll,
          serverSeedHash: actualSeedHash,
          oddsVersionHash: '',
          isBot: 0,
        });
        blink.db.table('battlePullAudits').createMany([battlePullAudits[battlePullAudits.length - 1]]).catch(() => {});
      }
    }

    let winnerResult: any = null;
    let winningTeam: 'left' | 'right' | null = null;

    if (mode !== 'shared' && playerResults.length > 0 && Number(battle.teamMode || battle.team_mode) === 0) {
      const pool = getWinnerPool(playerResults, botFaction);

      // A draw is only valid when every eligible player has the same total.
      // Do not let a partial tie (or a string/number comparison) erase a real
      // winner. Values are settled to cents by isExactTie().
      if (isExactTie(pool, mode)) {
        isDraw = true;
        playerResults.forEach(r => { r.isWinner = false; });
        winnerResult = null;
      } else {
        // Underdog's faction roll is part of the rules: once the faction is
        // selected, choose the winner only from that faction's pool.
        winnerResult = determineBattleWinner(pool, mode, botFaction);
        if (!winnerResult) {
          throw new Error('Unable to determine a winner for this battle');
        }
        playerResults.forEach(r => {
          r.isWinner = r.playerId === winnerResult.playerId;
        });
      }
    }

    // ── 2v2 mode: compare team totals, then mark both winners ───────────
    const isTeamBattle = Number(battle.teamMode || battle.team_mode) > 0;
    if (isTeamBattle) {
      const leftTotalCents = Math.round(playerResults
        .filter(r => r.teamSide === 'left')
        .reduce((sum, r) => sum + Number(r.totalValue || 0), 0) * 100);
      const rightTotalCents = Math.round(playerResults
        .filter(r => r.teamSide === 'right')
        .reduce((sum, r) => sum + Number(r.totalValue || 0), 0) * 100);
      if (leftTotalCents === rightTotalCents) {
        isDraw = true;
      } else {
        winningTeam = leftTotalCents > rightTotalCents ? 'left' : 'right';
        playerResults.forEach(r => { r.isWinner = r.teamSide === winningTeam; });
        winnerResult = playerResults.find(r => r.teamSide === winningTeam) || null;
      }
    }

    // ── Shared mode: pool and redistribute BEFORE saving to DB ──────────
    if (mode === 'shared') {
      playerResults.forEach(r => { r.isWinner = true; });
      const distribution = distributeCardsShared(
        playerResults.map(p => ({ playerId: p.playerId, cards: p.cards as OpenedCard[] })),
      );
      for (const pr of playerResults) {
        const share = distribution.get(pr.playerId) || [];
        pr.cards = share;
        pr.totalValue = Math.round(share.reduce((s: number, c: any) => s + (c.value ?? 0), 0) * 100) / 100;
      }
    }

    // Persist each player result explicitly. In particular, winner flags must
    // survive the response so every client can render the same outcome.
    for (const pr of playerResults) {
      await blink.db.battlePlayers.update(pr.playerId, {
        cardsJson: JSON.stringify(pr.cards),
        totalValue: pr.totalValue,
        isWinner: pr.isWinner ? 1 : 0,
      });
    }

    // ── Award cards to inventory ────────────────────────────────────────
    await awardBattleCards(
      blink,
      battleId,
      mode,
      isDraw,
      isTeamBattle,
      winningTeam,
      winnerResult,
      playerResults,
    );

    // Update leaderboard stats (only for human winners, not draws)
    if (!isDraw && mode !== 'shared' && winnerResult && !winnerResult.isAi) {
      try {
        const wUserId = winnerResult.userId;
        const totalValue = winnerResult.totalValue;
        const packsCount = battlePacks.length;
        const existingStats = await blink.db.leaderboardStats.list({ where: { id: wUserId } }) as any[];
        const ls = existingStats[0];
        if (ls) {
          await blink.db.leaderboardStats.update(ls.id, {
            packsOpened: Number(ls.packsOpened || 0) + packsCount,
            biggestPull: Math.max(Number(ls.biggestPull || 0), totalValue),
            updatedAt: new Date().toISOString(),
          });
        } else {
          await blink.db.leaderboardStats.create({
            id: wUserId,
            username: winnerResult.username,
            biggestPull: totalValue,
            packsOpened: packsCount,
            winStreak: 0,
            upgradesAttempted: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (lsErr: any) {
        console.error('[Battle Reward] Failed to update leaderboard stats:', lsErr.message);
      }
    }

    // 2v2 winnings are paid to both winning teammates in equal shares.
    if (isTeamBattle && winningTeam && !isDraw) {
      const winningPlayers = playerResults.filter(r => r.teamSide === winningTeam && !r.isAi);
      const teamPot = Number(battle.totalCost) * playerResults.length;
      const share = teamPot / Math.max(winningPlayers.length, 1);
      for (const player of winningPlayers) {
        await processWalletTransaction(blink, {
          userId: player.userId,
          type: 'battle_team_reward',
          amount: share,
          sourceId: `${battleId}_${winningTeam}`,
          metadata: { teamSide: winningTeam, teamPot, share },
        });
      }
    }

    // Finalize the battle on the backend, after player rows and rewards are
    // committed. The client animation is presentation only and must not be
    // responsible for changing a live battle into a finished one.
    await blink.db.battles.update(battleId, {
      status: 'finished',
      endedAt: new Date().toISOString(),
      isSpinning: 0,
      winnerUserId: winnerResult?.userId || null,
      winnerUsername: winnerResult?.username || null,
    });

    // Write activity log (non-critical)
    try {
      const packs = JSON.parse(battle.packsJson || '[]');
      const packNames = packs.map((p: any) => p.name).join(', ');
      const totalPot2 = Number(battle.totalCost) * playerResults.length;
      const resultLabel = isDraw ? 'draw' : 'completed';
      await writeLog(blink, {
        type: 'battle',
        userId: (isDraw || mode === 'shared') ? null : (winnerResult?.userId || null),
        username: isDraw ? 'Draw' : (mode === 'shared' ? 'Shared' : (winnerResult?.username || 'Unknown')),
        action: `Pack Battle ${isDraw ? '(Draw)' : mode === 'shared' ? '(Shared)' : mode === 'underdog' ? '(Underdog)' : '(Standard)'}`,
        details: {
          battleId,
          mode,
          isDraw,
          packNames,
          players: playerResults.map(pr => ({
            username: pr.username,
            isAi: pr.isAi,
            totalValue: pr.totalValue,
            isWinner: pr.isWinner,
            cards: pr.cards.slice(0, 5).map((c: any) => ({ name: c.name, value: c.value, rarity: c.rarity })),
          })),
          winner: (isDraw || mode === 'shared') ? null : (winnerResult ? { username: winnerResult.username, totalValue: winnerResult.totalValue } : null),
          totalPot: totalPot2,
        },
        valueIn: totalPot2,
        valueOut: isDraw ? 0 : (mode === 'shared' ? totalPot2 : (winnerResult?.totalValue || 0)),
        result: resultLabel,
      });
    } catch { /* non-critical */ }

    console.log(`[battles/execute] Battle ${battleId} executed (provably fair). ${isDraw ? 'Result: DRAW' : 'Rewards awarded.'}`);

    return c.json({
      success: true,
      playerResults,
      winner: winnerResult,
      isDraw,
    });

  } catch (err: any) {
    console.error('[battles/execute] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
