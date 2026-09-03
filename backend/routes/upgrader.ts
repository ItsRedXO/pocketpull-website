/**
 * Upgrader Routes — win/loss determination is server-side only.
 * Critical economy mutations are committed in one PostgreSQL transaction.
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../lib/auth';
import { writeLog } from './logs';
import { transaction, query } from '../lib/postgres';
import { processWalletTransactionInClient } from '../repositories/wallet';
import { sha256, computeRoll } from '../lib/provablyFair';
import { getOrCreateServerSeed } from '../lib/provablyFairServerSeed';

const app = new Hono();
const MAX_CHANCE_CHART: Record<number, number> = {1.2:70,1.5:55,2.0:35,3.0:35,4.0:35,5.0:15,6.0:15,7.0:15,8.0:8,9.0:8,10.0:8};

class UpgraderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const money = (value: number) => Math.round(value * 100) / 100;

app.post('/upgrader/spin', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json<any>();
    const inventoryIds = Array.isArray(body.inventoryIds) ? body.inventoryIds.map(String) : [];
    const targetCardIds = Array.isArray(body.targetCardIds) ? body.targetCardIds.map(String) : [];
    const useBalance = body.useBalance === true;
    const addedBalance = Number(body.addedBalance || 0);
    const multiplier = Number(body.multiplier);

    if (!inventoryIds.length) return c.json({ error: 'inventoryIds required' }, 400);
    if (!targetCardIds.length) return c.json({ error: 'targetCardIds required' }, 400);
    if (inventoryIds.length > 100 || targetCardIds.length > 100) return c.json({ error: 'Too many cards selected' }, 400);
    if (new Set(inventoryIds).size !== inventoryIds.length) return c.json({ error: 'Duplicate inventory cards are not allowed' }, 400);
    if (new Set(targetCardIds).size !== targetCardIds.length) return c.json({ error: 'Duplicate target cards are not allowed' }, 400);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return c.json({ error: 'Invalid multiplier' }, 400);

    const { seed: serverSeed, seedHash: actualSeedHash } = await getOrCreateServerSeed((c.env as any).BLINK_SERVER_SEED);

    const clientSeed = `cs_${uid()}`;
    const result = await transaction(async (client) => {
      const userResult = await client.query(
        `SELECT id,username,display_name,balance,matched_balance,is_deleted,is_banned,is_bot
         FROM users WHERE id=$1 FOR UPDATE`,
        [userId],
      );
      if (!userResult.rowCount) throw new UpgraderError('User not found', 404);
      const user = userResult.rows[0] as any;
      if (Number(user.is_deleted || 0) > 0) throw new UpgraderError('Account deactivated', 403);
      if (Number(user.is_banned || 0) > 0) throw new UpgraderError('Account banned', 403);

      const inventoryResult = await client.query(
        `SELECT id,card_id,card_name,rarity,value,card_image_url,is_locked,locked,sold
         FROM inventory
         WHERE user_id=$1 AND id=ANY($2::text[])
         FOR UPDATE`,
        [userId, inventoryIds],
      );
      const inventoryMap = new Map(inventoryResult.rows.map((row:any) => [String(row.id), row]));
      const selectedCards = inventoryIds.map((id:string) => {
        const card:any = inventoryMap.get(id);
        if (!card) throw new UpgraderError(`Card ${id} not found in your inventory`);
        if (Number(card.sold || 0) > 0) throw new UpgraderError(`Card ${id} is no longer available`);
        if (Number(card.is_locked || card.locked || 0) > 0) throw new UpgraderError(`Card ${id} is locked and cannot be used`);
        return card;
      });

      const selectedCardTotal = selectedCards.reduce((sum:number, card:any) => sum + Number(card.value || 0), 0);
      const effectiveAddedBalance = useBalance ? Math.max(0, Number.isFinite(addedBalance) ? addedBalance : 0) : 0;
      const realBalance = Number(user.balance || 0);
      if (effectiveAddedBalance > realBalance) {
        throw new UpgraderError('Insufficient real balance for the added amount. Matched bonus funds cannot be used in the Upgrader.');
      }
      const totalUpgradeValue = selectedCardTotal + effectiveAddedBalance;
      if (totalUpgradeValue < 0.5) throw new UpgraderError('Minimum upgrade value is $0.50');

      const targetResult = await client.query(
        `SELECT id,card_name,name,rarity,estimated_value,value,card_image_url,image_url
         FROM pack_cards WHERE id=ANY($1::text[])`,
        [targetCardIds],
      );
      const targetMap = new Map(targetResult.rows.map((row:any) => [String(row.id), row]));
      const targetCards = targetCardIds.map((id:string) => {
        const card:any = targetMap.get(id);
        if (!card) throw new UpgraderError(`Target card ${id} not found`);
        return card;
      });
      const totalTargetVal = targetCards.reduce((sum:number, card:any) => sum + Number(card.estimated_value ?? card.value ?? 0), 0);
      if (totalTargetVal <= 0) throw new UpgraderError('Target cards have no value');

      let maxChanceLimit = MAX_CHANCE_CHART[multiplier] || 75;
      const settingResult = await client.query(`SELECT max_chance FROM upgrader_multiplier_settings WHERE id=$1 LIMIT 1`, [multiplier]);
      if (settingResult.rowCount) maxChanceLimit = Math.min(maxChanceLimit, Number(settingResult.rows[0].max_chance));

      const baselineTargetValue = totalUpgradeValue * multiplier;
      if (totalTargetVal < baselineTargetValue - 0.01) {
        throw new UpgraderError(`Target value ($${totalTargetVal.toFixed(2)}) must be at least $${baselineTargetValue.toFixed(2)} for ${multiplier}x multiplier.`);
      }
      const calculatedFinalChance = maxChanceLimit * (baselineTargetValue / totalTargetVal);
      const winChance = Math.min(maxChanceLimit, Math.max(0.1, calculatedFinalChance));
      const oddsSnapshot = JSON.stringify({
        multiplier,
        maxChanceLimit,
        baselineTargetValue: money(baselineTargetValue),
        totalTargetVal: money(totalTargetVal),
        totalUpgradeValue: money(totalUpgradeValue),
        effectiveAddedBalance: money(effectiveAddedBalance),
        selectedCardTotal: money(selectedCardTotal),
        winChance: money(winChance),
      });
      const oddsVersionHash = await sha256(oddsSnapshot);

      const nonceResult = await client.query(
        `INSERT INTO user_nonces(user_id,upgrade_nonce,updated_at)
         VALUES($1,1,now())
         ON CONFLICT(user_id) DO UPDATE
         SET upgrade_nonce=user_nonces.upgrade_nonce+1,updated_at=now()
         RETURNING upgrade_nonce`,
        [userId],
      );
      const nonce = Number(nonceResult.rows[0].upgrade_nonce);
      if (!Number.isFinite(nonce) || nonce < 1) throw new Error('Provably fair nonce persistence failed');

      const rollValue = await computeRoll(serverSeed, clientSeed, nonce);
      const isWin = rollValue <= winChance;
      const isBot = Number(user.is_bot || 0) > 0;
      const recipientId = getRewardUserId(userId, isBot);
      const wonCards:any[] = [];

      let consolationCard:any = null;
      if (!isWin) {
        const consolationResult = await client.query(
          `SELECT id,card_name,name,rarity,estimated_value,value,card_image_url,image_url
           FROM pack_cards
           WHERE COALESCE(estimated_value,value,0) BETWEEN 0.02 AND 0.07
           ORDER BY id
           LIMIT 500`,
        );
        if (consolationResult.rowCount) {
          const consolationRoll = await computeRoll(serverSeed, `${clientSeed}:consolation`, nonce);
          const index = Math.floor((consolationRoll / 100) * consolationResult.rows.length) % consolationResult.rows.length;
          consolationCard = consolationResult.rows[index];
          if (targetCardIds.includes(String(consolationCard.id))) throw new Error('Consolation prize conflict. Please try again.');
        }
      }

      if (effectiveAddedBalance > 0) {
        const walletResult = await processWalletTransactionInClient(client, {
          userId,
          type: 'upgrade',
          amount: -effectiveAddedBalance,
          sourceId: `upgrader:${userId}:${nonce}`,
          metadata: { nonce, clientSeed },
          allowMatchedDebit: false,
        });
        if (!walletResult.success) throw new UpgraderError(walletResult.error || 'Failed to deduct balance');
      }

      const removed = await client.query(
        `DELETE FROM inventory
         WHERE user_id=$1 AND id=ANY($2::text[]) AND sold=0
         RETURNING id`,
        [userId, inventoryIds],
      );
      if (removed.rowCount !== inventoryIds.length) throw new Error('Inventory changed during upgrade. Please try again.');

      const awardCard = async (card:any, emoji:string) => {
        const newInvId = `inv_${uid()}`;
        const name = card.card_name || card.name || 'Unknown Card';
        const value = Number(card.estimated_value ?? card.value ?? 0);
        const imageUrl = card.card_image_url || card.image_url || null;
        await client.query(
          `INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,emoji,card_image_url,is_favorite,favorite,is_locked,locked,sold,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,0,0,0,0,now())`,
          [newInvId, recipientId, card.id, name, card.rarity || null, value, emoji, imageUrl],
        );
        wonCards.push({ id:newInvId, cardId:String(card.id), name, rarity:card.rarity || null, value, emoji, cardImageUrl:imageUrl });
      };

      if (isWin) {
        for (const card of targetCards) await awardCard(card, '⭐');
      } else if (consolationCard) {
        await awardCard(consolationCard, '🃏');
      }
      if (!isWin && wonCards.some((card:any) => targetCardIds.includes(card.cardId))) throw new Error('Security violation detected in payout logic.');

      await client.query(
        `INSERT INTO upgrader_spins(
          id,user_id,multiplier,total_input_value,balance_used,baseline_target_value,total_target_value,
          win_chance,is_win,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,
          won_cards_json,removed_card_ids_json,provably_fair,created_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,now())`,
        [
          `us_${uid()}`, userId, multiplier, money(totalUpgradeValue), money(effectiveAddedBalance), money(baselineTargetValue),
          money(totalTargetVal), money(winChance), isWin ? 1 : 0, clientSeed, nonce, Math.round(rollValue * 10000) / 10000,
          actualSeedHash, oddsVersionHash, JSON.stringify(wonCards), JSON.stringify(inventoryIds),
        ],
      );

      await client.query(
        `INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at)
         VALUES($1,$2,'upgrade',$3,$4,$5,now())`,
        [
          `txn_${uid()}`,
          userId,
          isWin ? totalTargetVal - totalUpgradeValue : -totalUpgradeValue,
          isWin ? `Upgrade WIN: ${targetCards.map((card:any) => card.card_name || card.name).join(', ')}` : 'Upgrade FAIL (Consolation awarded)',
          `upgrader-spin:${userId}:${nonce}`,
        ],
      );

      const finalBalanceResult = await client.query(`SELECT balance FROM users WHERE id=$1`, [userId]);
      return {
        user,
        selectedCards,
        targetCards,
        wonCards,
        isWin,
        winChance,
        totalUpgradeValue,
        totalTargetVal,
        effectiveAddedBalance,
        nonce,
        rollValue,
        newBalance: Number(finalBalanceResult.rows[0]?.balance || 0),
      };
    });

    try {
      await query(
        `INSERT INTO leaderboard_stats(id,username,biggest_pull,packs_opened,win_streak,upgrades_attempted,updated_at)
         VALUES($1,$2,0,0,0,1,now())
         ON CONFLICT(id) DO UPDATE SET upgrades_attempted=leaderboard_stats.upgrades_attempted+1,updated_at=now()`,
        [userId, result.user.username || result.user.display_name || 'Trainer'],
      );
    } catch (err:any) { console.error('[upgrader/spin] leaderboard update failed:', err?.message); }

    try {
      await writeLog(blink, {
        type: 'upgrade',
        userId,
        username: result.user.username || result.user.display_name || 'Trainer',
        action: result.isWin ? 'Upgrade WIN' : 'Upgrade LOSS',
        details: {
          cardsUsed: result.selectedCards.map((card:any) => ({ name:card.card_name, value:Number(card.value), rarity:card.rarity })),
          targetCards: result.targetCards.map((card:any) => ({ name:card.card_name || card.name, value:Number(card.estimated_value ?? card.value), rarity:card.rarity })),
          prizeReceived: result.wonCards.map((card:any) => ({ name:card.name, value:card.value, rarity:card.rarity })),
          winChance: money(result.winChance),
          balanceUsed: result.effectiveAddedBalance,
          nonce: result.nonce,
          rollValue: result.rollValue,
        },
        valueIn: result.totalUpgradeValue,
        valueOut: result.isWin ? result.totalTargetVal : (result.wonCards[0]?.value || 0),
        result: result.isWin ? 'win' : 'loss',
      });
    } catch (err:any) { console.error('[upgrader/spin] activity log failed:', err?.message); }

    return c.json({
      success: true,
      isWin: result.isWin,
      winChance: money(result.winChance),
      wonCards: result.wonCards,
      targetCards: result.targetCards.map((card:any) => ({
        cardId: String(card.id),
        name: card.card_name || card.name,
        rarity: card.rarity,
        value: Number(card.estimated_value ?? card.value),
        cardImageUrl: card.card_image_url || card.image_url || null,
      })),
      newBalance: result.newBalance,
      removedCardIds: inventoryIds,
    });
  } catch (err:any) {
    console.error('[upgrader/spin] error:', err.message);
    if (err instanceof UpgraderError) return c.json({ error: err.message }, err.status as any);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
