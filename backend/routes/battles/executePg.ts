import { Hono } from 'hono';
import { requireAuth, uid, getRewardUserId } from '../../lib/auth';
import { query, transaction } from '../../lib/postgres';
import { processWalletTransactionInClient } from '../../repositories/wallet';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../../lib/provablyFair';
import { getOrCreateServerSeed } from '../../lib/provablyFairServerSeed';
import { rollBotWinChance, determineBattleWinner, distributeCardsShared, getWinnerPool, isExactTie, RARITY_EMOJIS } from './utils';
import type { OpenedCard, BattlePullAudit } from './types';

const app = new Hono();

function parseJson(value: unknown, fallback: any = []) {
  try { return JSON.parse(String(value ?? '')); } catch { return fallback; }
}

app.post('/execute', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const battleId = String(body?.battleId || '');
  if (!battleId) return c.json({ error: 'battleId required' }, 400);

  try {
    const seed = await getOrCreateServerSeed((c.env as any).BLINK_SERVER_SEED);

    const result = await transaction(async (client) => {
      const battleRows = await client.query('SELECT * FROM battles WHERE id=$1 FOR UPDATE', [battleId]);
      const battle: any = battleRows.rows[0];
      if (!battle) throw Object.assign(new Error('Battle not found'), { status: 404 });
      if (battle.host_user_id !== userId) throw Object.assign(new Error('Only host can execute battle'), { status: 403 });
      if (battle.status === 'finished') {
        const playerRows = await client.query('SELECT * FROM battle_players WHERE battle_id=$1 ORDER BY joined_at,id', [battleId]);
        return { alreadyFinished: true, battle, players: playerRows.rows };
      }
      if (battle.status !== 'waiting' && battle.status !== 'starting') {
        throw Object.assign(new Error(`Battle is in status ${battle.status}`), { status: 400 });
      }

      const playersResult = await client.query('SELECT * FROM battle_players WHERE battle_id=$1 ORDER BY joined_at,id', [battleId]);
      const players: any[] = playersResult.rows;
      if (players.length < 2) throw Object.assign(new Error('Battle needs at least 2 players'), { status: 400 });

      const packs: any[] = parseJson(battle.packs_json, []);
      const packIds = [...new Set(packs.map((p: any) => String(p?.id || '')).filter(Boolean))];
      if (!packIds.length) throw new Error('Battle has no packs configured');

      const cardResult = await client.query(
        `SELECT id,pack_id,card_name,name,rarity,estimated_value,value,card_image_url,image_url,odds,pull_chance
         FROM pack_cards WHERE pack_id=ANY($1::text[]) ORDER BY pack_id,id`,
        [packIds],
      );
      const allCards = cardResult.rows as any[];
      const cardsByPack = new Map<string, any[]>();
      for (const packId of packIds) cardsByPack.set(packId, allCards.filter(card => String(card.pack_id) === packId));
      for (const packId of packIds) if (!(cardsByPack.get(packId) || []).length) throw new Error(`Pack ${packId} has no cards configured`);

      const claimed = await client.query(
        `UPDATE battles SET status='live',started_at=COALESCE(started_at,now()),current_step=0 WHERE id=$1 AND status IN ('waiting','starting') RETURNING id`,
        [battleId],
      );
      if (!claimed.rowCount) throw Object.assign(new Error('Battle execution already in progress'), { status: 409 });

      const mode = battle.mode || 'standard';
      const playerResults: any[] = [];
      const audits: BattlePullAudit[] = [];
      const humanPulls: any[] = [];
      let pullIndex = 0;

      for (const player of players) {
        const isAi = Number(player.is_ai || 0) > 0;
        const cards: OpenedCard[] = [];
        const playerUserId = String(player.user_id || '');

        for (const pack of packs) {
          pullIndex++;
          const packId = String(pack.id);
          const dbCards = cardsByPack.get(packId) || [];
          let nonce: number;
          if (isAi) {
            nonce = pullIndex;
          } else {
            const nonceRows = await client.query(
              `INSERT INTO user_nonces(user_id,pack_nonce,updated_at)
               VALUES($1,1,now())
               ON CONFLICT(user_id) DO UPDATE SET pack_nonce=COALESCE(user_nonces.pack_nonce,0)+1,updated_at=now()
               RETURNING pack_nonce`,
              [playerUserId],
            );
            nonce = Number(nonceRows.rows[0]?.pack_nonce);
          }
          if (!Number.isFinite(nonce) || nonce < 1) throw new Error('Provably fair nonce persistence failed');

          const oddsJson = buildOddsSnapshot(dbCards);
          const oddsHash = await sha256(oddsJson);
          const clientSeed = `cs_bt_${uid()}`;
          const rollValue = await computeRoll(seed.seed, clientSeed, nonce);
          const picked = dbCards[selectCardIndex(rollValue, dbCards)];
          if (!picked) throw new Error(`Unable to select a card from pack ${packId}`);

          const name = picked.card_name || picked.name || 'Unknown Card';
          const rarity = picked.rarity || 'common';
          const value = Number(picked.estimated_value ?? picked.value ?? 0);
          const imageUrl = picked.card_image_url || picked.image_url || null;
          const card: OpenedCard = {
            id: `po_${uid()}`,
            name,
            rarity,
            value,
            imageUrl,
            packId,
            packName: pack.name,
            emoji: RARITY_EMOJIS[rarity] || '🃏',
            clientSeed,
            nonce,
            rollValue,
            serverSeedHash: seed.seedHash,
            oddsVersionHash: oddsHash,
            isBot: isAi,
          } as any;
          cards.push(card);

          audits.push({
            id: `bpa_${uid()}`,
            battleId,
            battlePlayerId: player.id,
            userId: playerUserId,
            packId,
            packName: pack.name,
            cardName: name,
            rarity,
            cost: Number(pack.price || 0),
            clientSeed,
            nonce,
            rollValue,
            serverSeedHash: seed.seedHash,
            oddsVersionHash: oddsHash,
            isBot: isAi ? 1 : 0,
          } as any);

          if (!isAi) {
            humanPulls.push({
              userId: playerUserId, packId, packName: pack.name, cost: Number(pack.price || 0),
              cardName: name, rarity, clientSeed, nonce, rollValue,
              serverSeedHash: seed.seedHash, oddsVersionHash: oddsHash,
            });
          }
        }

        const totalValue = Math.round(cards.reduce((sum, card) => sum + Number(card.value || 0), 0) * 100) / 100;
        playerResults.push({
          playerId: player.id,
          teamSide: player.team_side || null,
          userId: playerUserId,
          username: player.username,
          avatar: player.avatar,
          isAi,
          cards,
          totalValue,
          isWinner: false,
        });
      }

      let botFaction: 'bot'|'human'|null = null;
      let isDraw = false;
      if (mode === 'underdog') {
        const hasBots = playerResults.some(p => p.isAi);
        const hasHumans = playerResults.some(p => !p.isAi);
        if (hasBots && hasHumans) {
          const diceRoll = await computeRoll(seed.seed, `dice_${battleId}`, pullIndex + 1);
          botFaction = rollBotWinChance(playerResults, mode, diceRoll);
        }
      }

      let winnerResult: any = null;
      let winningTeam: 'left'|'right'|null = null;
      const isTeamBattle = Number(battle.team_mode || 0) > 0;
      if (mode !== 'shared' && !isTeamBattle) {
        const pool = getWinnerPool(playerResults, botFaction);
        if (isExactTie(pool, mode)) isDraw = true;
        else winnerResult = determineBattleWinner(pool, mode, botFaction);
        if (winnerResult) for (const p of playerResults) p.isWinner = p.playerId === winnerResult.playerId;
      }

      if (isTeamBattle) {
        const left = Math.round(playerResults.filter(p => p.teamSide === 'left').reduce((s,p) => s + p.totalValue, 0) * 100);
        const right = Math.round(playerResults.filter(p => p.teamSide === 'right').reduce((s,p) => s + p.totalValue, 0) * 100);
        if (left === right) isDraw = true;
        else {
          winningTeam = left > right ? 'left' : 'right';
          for (const p of playerResults) p.isWinner = p.teamSide === winningTeam;
          winnerResult = playerResults.find(p => p.teamSide === winningTeam) || null;
        }
      }

      if (mode === 'shared') {
        for (const p of playerResults) p.isWinner = true;
        const distribution = distributeCardsShared(playerResults.map(p => ({ playerId: p.playerId, cards: p.cards })));
        for (const p of playerResults) {
          p.cards = distribution.get(p.playerId) || [];
          p.totalValue = Math.round(p.cards.reduce((s:number, card:any) => s + Number(card.value || 0), 0) * 100) / 100;
        }
      }

      const rewardAssignments: Array<{ card: any; userId: string; playerId: string }> = [];
      if (mode === 'shared' || isDraw) {
        for (const p of playerResults) for (const card of p.cards) rewardAssignments.push({ card, userId: getRewardUserId(p.userId, p.isAi), playerId: p.playerId });
      } else if (isTeamBattle && winningTeam) {
        const winners = playerResults.filter(p => p.teamSide === winningTeam);
        const all = playerResults.flatMap(p => p.cards);
        all.forEach((card, index) => { const recipient = winners[index % Math.max(winners.length,1)]; if (recipient) rewardAssignments.push({ card, userId: getRewardUserId(recipient.userId, recipient.isAi), playerId: recipient.playerId }); });
      } else if (winnerResult) {
        for (const p of playerResults) for (const card of p.cards) rewardAssignments.push({ card, userId: getRewardUserId(winnerResult.userId, winnerResult.isAi), playerId: winnerResult.playerId });
      }

      const awardedInventoryIds = new Map<string, string[]>();
      for (const assignment of rewardAssignments) {
        const invId = `inv_${uid()}`;
        const pack = packs.find((p:any) => String(p.id) === String(assignment.card.packId));
        await client.query(
          `INSERT INTO inventory(id,user_id,card_id,pack_id,battle_id,card_name,rarity,value,emoji,card_image_url,pack_name,is_favorite,favorite,is_locked,locked,sold,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,0,0,0,now())`,
          [invId, assignment.userId, assignment.card.cardId || assignment.card.id, assignment.card.packId || null, battleId, assignment.card.name, assignment.card.rarity, Number(assignment.card.value || 0), assignment.card.emoji || '🃏', assignment.card.imageUrl || null, assignment.card.packName || pack?.name || null],
        );
        const list = awardedInventoryIds.get(assignment.userId) || [];
        list.push(invId);
        awardedInventoryIds.set(assignment.userId, list);
      }

      for (const p of playerResults) {
        await client.query(
          `UPDATE battle_players SET cards_json=$1,total_value=$2,is_winner=$3 WHERE id=$4`,
          [JSON.stringify(p.cards), p.totalValue, p.isWinner ? 1 : 0, p.playerId],
        );
      }

      for (const audit of audits) {
        await client.query(
          `INSERT INTO battle_pull_audits(id,battle_id,participant_id,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,data)
           VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8)`,
          [audit.id, battleId, audit.clientSeed, audit.nonce, audit.rollValue, audit.serverSeedHash, audit.oddsVersionHash, JSON.stringify({ battlePlayerId: audit.battlePlayerId, userId: audit.userId, packId: audit.packId, packName: audit.packName, cardName: audit.cardName, rarity: audit.rarity, cost: audit.cost, isBot: audit.isBot })],
        );
      }

      for (const pull of humanPulls) {
        await client.query(
          `INSERT INTO packs_opened(id,user_id,pack_id,pack_name,cost,card_name,rarity,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,provably_fair,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,now())`,
          [`po_${uid()}`, pull.userId, pull.packId, pull.packName, pull.cost, pull.cardName, pull.rarity, pull.clientSeed, pull.nonce, pull.rollValue, pull.serverSeedHash, pull.oddsVersionHash],
        );
      }

      if (isTeamBattle && winningTeam && !isDraw) {
        const winningPlayers = playerResults.filter(p => p.teamSide === winningTeam && !p.isAi);
        const teamPot = Number(battle.total_cost || 0) * playerResults.length;
        const share = teamPot / Math.max(winningPlayers.length, 1);
        for (const p of winningPlayers) {
          const wallet = await processWalletTransactionInClient(client, {
            userId: p.userId,
            type: 'battle_team_reward',
            amount: share,
            sourceId: `${battleId}_${winningTeam}`,
            metadata: { teamSide: winningTeam, teamPot, share },
          });
          if (!wallet.success) throw new Error(wallet.error || 'Failed to award team battle winnings');
        }
      }

      await client.query(
        `UPDATE battles SET status='finished',ended_at=now(),is_spinning=0,winner_user_id=$1,winner_username=$2 WHERE id=$3`,
        [winnerResult?.userId || null, winnerResult?.username || null, battleId],
      );

      return { alreadyFinished: false, battle, playerResults, winner: winnerResult, isDraw };
    });

    if (result.alreadyFinished) {
      const playerResults = result.players.map((p:any) => ({
        playerId: p.id, teamSide: p.team_side || null, userId: p.user_id, username: p.username, avatar: p.avatar,
        isAi: Number(p.is_ai || 0) > 0, cards: parseJson(p.cards_json, []), totalValue: Number(p.total_value || 0), isWinner: Number(p.is_winner || 0) > 0,
      }));
      return c.json({ success: true, playerResults, winner: playerResults.find(p => p.isWinner) || null, isDraw: false });
    }

    return c.json({ success: true, playerResults: result.playerResults, winner: result.winner, isDraw: result.isDraw });
  } catch (err: any) {
    console.error('[battles/execute-pg] error:', err?.message || err);
    try {
      await query(`UPDATE battles SET status='waiting',started_at=NULL WHERE id=$1 AND status='live'`, [battleId]);
    } catch { /* best effort */ }
    const status = Number(err?.status) || 500;
    return c.json({ error: err?.message || 'Battle execution failed' }, status);
  }
});

export default app;
