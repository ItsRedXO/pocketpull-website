import { randomUUID } from 'node:crypto';
import { getDb, type DbEnv } from '../client';
import { computeRoll, sha256 } from '../../lib/provablyFair';

const MAX_CHANCE_CHART: Record<number, number> = { 1.2: 70, 1.5: 55, 2: 35, 3: 35, 4: 35, 5: 15, 6: 15, 7: 15, 8: 8, 9: 8, 10: 8 };

export interface UpgraderInput {
  userId: string; inventoryIds: string[]; targetCardIds: string[]; useBalance: boolean;
  addedBalance: number; multiplier: number; serverSeed: string; serverSeedHash: string; clientSeed: string;
}
export interface UpgraderResult {
  success: boolean; error?: string; isWin?: boolean; winChance?: number; wonCards?: any[];
  targetCards?: any[]; newBalance?: number; removedCardIds?: string[]; nonce?: number; rollValue?: number; oddsVersionHash?: string;
}

export async function spinUpgrader(env: DbEnv, input: UpgraderInput): Promise<UpgraderResult> {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(`SELECT id,username,display_name,balance,matched_balance,is_deleted,is_banned,is_bot FROM users WHERE id=$1 FOR UPDATE`, [input.userId]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return { success: false, error: 'User not found' }; }
    if (user.is_deleted) { await client.query('ROLLBACK'); return { success: false, error: 'Account deactivated' }; }
    if (user.is_banned) { await client.query('ROLLBACK'); return { success: false, error: 'Account banned' }; }

    const inventoryResult = await client.query(`SELECT id,card_id,card_name,rarity,value,emoji,card_image_url,is_locked FROM inventory WHERE user_id=$1 AND id=ANY($2::text[]) FOR UPDATE`, [input.userId, input.inventoryIds]);
    const inventoryById = new Map(inventoryResult.rows.map(r => [r.id, r]));
    for (const id of input.inventoryIds) {
      const card = inventoryById.get(id);
      if (!card) { await client.query('ROLLBACK'); return { success: false, error: `Card ${id} not found in your inventory` }; }
      if (card.is_locked) { await client.query('ROLLBACK'); return { success: false, error: `Card ${id} is locked and cannot be used` }; }
    }

    const targets = await client.query(`SELECT id,card_name,rarity,estimated_value,card_image_url FROM pack_cards WHERE id=ANY($1::text[])`, [input.targetCardIds]);
    const targetMap = new Map(targets.rows.map(r => [r.id, r]));
    const targetCards: any[] = [];
    for (const id of input.targetCardIds) {
      const card = targetMap.get(id);
      if (!card) { await client.query('ROLLBACK'); return { success: false, error: `Target card ${id} not found` }; }
      targetCards.push(card);
    }

    const balance = Number(user.balance || 0), matched = Number(user.matched_balance || 0);
    const realBalance = Math.max(0, balance - matched), added = input.useBalance ? Math.max(0, Number(input.addedBalance) || 0) : 0;
    if (added > realBalance) { await client.query('ROLLBACK'); return { success: false, error: 'Insufficient real balance for the added amount. Matched bonus funds cannot be used in the Upgrader.' }; }
    const selectedTotal = inventoryResult.rows.reduce((s, r) => s + Number(r.value || 0), 0), totalInput = selectedTotal + added;
    if (totalInput < 0.5) { await client.query('ROLLBACK'); return { success: false, error: 'Minimum upgrade value is $0.50' }; }
    const totalTarget = targetCards.reduce((s, r) => s + Number(r.estimated_value || 0), 0);
    if (totalTarget <= 0) { await client.query('ROLLBACK'); return { success: false, error: 'Target cards have no value' }; }

    let maxChance = MAX_CHANCE_CHART[input.multiplier] || 75;
    const setting = await client.query(`SELECT max_chance FROM upgrader_multiplier_settings WHERE multiplier=$1`, [input.multiplier]);
    if (setting.rows[0]) maxChance = Math.min(maxChance, Number(setting.rows[0].max_chance));
    const baseline = totalInput * input.multiplier;
    if (totalTarget < baseline - 0.01) { await client.query('ROLLBACK'); return { success: false, error: `Target value ($${totalTarget.toFixed(2)}) must be at least $${baseline.toFixed(2)} for ${input.multiplier}x multiplier.` }; }
    const winChance = Math.min(maxChance, Math.max(0.1, maxChance * (baseline / totalTarget)));
    const oddsSnapshot = JSON.stringify({ multiplier: input.multiplier, maxChanceLimit: maxChance, baselineTargetValue: Math.round(baseline*100)/100, totalTargetVal: Math.round(totalTarget*100)/100, totalUpgradeValue: Math.round(totalInput*100)/100, effectiveAddedBalance: Math.round(added*100)/100, selectedCardTotal: Math.round(selectedTotal*100)/100, winChance: Math.round(winChance*100)/100 });
    const oddsVersionHash = await sha256(oddsSnapshot);

    const nonceResult = await client.query(`INSERT INTO user_nonces(user_id,pack_nonce,upgrade_nonce) VALUES($1,0,1) ON CONFLICT(user_id) DO UPDATE SET upgrade_nonce=user_nonces.upgrade_nonce+1 RETURNING upgrade_nonce`, [input.userId]);
    const nonce = Number(nonceResult.rows[0]?.upgrade_nonce);
    if (!Number.isInteger(nonce) || nonce < 1) throw new Error('Provably fair system error — nonce read failed. Please try again.');
    const rollValue = await computeRoll(input.serverSeed, input.clientSeed, nonce), isWin = rollValue <= winChance;

    const wonCards: any[] = [];
    if (isWin) {
      for (const target of targetCards) {
        const id = `inv_${randomUUID().replaceAll('-','').slice(0,20)}`;
        await client.query(`INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,created_at,card_image_url,pack_name,is_locked,battle_id) VALUES($1,$2,$3,$4,$5,$6,'⭐',FALSE,NOW(),$7,NULL,FALSE,NULL)`, [id,input.userId,target.id,target.card_name,target.rarity,Number(target.estimated_value),target.card_image_url||null]);
        wonCards.push({ id, cardId: target.id, name: target.card_name, rarity: target.rarity, value: Number(target.estimated_value), emoji:'⭐', cardImageUrl: target.card_image_url||null });
      }
    } else {
      const pool = await client.query(`SELECT id,card_name,rarity,estimated_value,card_image_url FROM pack_cards WHERE estimated_value BETWEEN 0.02 AND 0.07 ORDER BY id`);
      if (pool.rows.length) {
        const consolationRoll = await computeRoll(input.serverSeed, `${input.clientSeed}:consolation`, nonce);
        const card = pool.rows[Math.floor((consolationRoll/100)*pool.rows.length)%pool.rows.length];
        if (!input.targetCardIds.includes(card.id)) {
          const id=`inv_${randomUUID().replaceAll('-','').slice(0,20)}`;
          await client.query(`INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,created_at,card_image_url,pack_name,is_locked,battle_id) VALUES($1,$2,$3,$4,$5,$6,'🃏',FALSE,NOW(),$7,NULL,FALSE,NULL)`, [id,input.userId,card.id,card.card_name,card.rarity,Number(card.estimated_value),card.card_image_url||null]);
          wonCards.push({ id,cardId:card.id,name:card.card_name,rarity:card.rarity,value:Number(card.estimated_value),emoji:'🃏',cardImageUrl:card.card_image_url||null });
        }
      }
    }

    await client.query(`DELETE FROM inventory WHERE user_id=$1 AND id=ANY($2::text[])`, [input.userId,input.inventoryIds]);
    const newBalance = balance - added;
    if (added > 0) {
      await client.query(`UPDATE users SET balance=$2,updated_at=NOW() WHERE id=$1`, [input.userId,newBalance]);
      await client.query(`INSERT INTO wallet_transactions(id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES($1,$2,'upgrade',$3,$4,$5,$6,$7,$8,$9::jsonb,NOW()) ON CONFLICT(id) DO NOTHING`, [`wt_upgrade_${input.userId}_${nonce}`,input.userId,-added,balance,newBalance,matched,matched,`upgrade_${input.userId}_${nonce}`,JSON.stringify({nonce,multiplier:input.multiplier})]);
    }
    const spinId=`us_${randomUUID().replaceAll('-','').slice(0,20)}`;
    await client.query(`INSERT INTO upgrader_spins(id,user_id,multiplier,total_input_value,balance_used,baseline_target_value,total_target_value,win_chance,is_win,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,won_cards_json,removed_card_ids_json,provably_fair,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,TRUE,NOW())`, [spinId,input.userId,input.multiplier,totalInput,added,baseline,totalTarget,winChance,isWin,input.clientSeed,nonce,rollValue,input.serverSeedHash,oddsVersionHash,JSON.stringify(wonCards),JSON.stringify(input.inventoryIds)]);
    await client.query(`INSERT INTO transactions(id,user_id,type,amount,description,created_at) VALUES($1,$2,'upgrade',$3,$4,NOW())`, [`txn_upgrade_${input.userId}_${nonce}`,input.userId,isWin?totalTarget-totalInput:-totalInput,isWin?`Upgrade WIN: ${targetCards.map(c=>c.card_name).join(', ')}`:'Upgrade FAIL (Consolation awarded)']);
    await client.query(`INSERT INTO leaderboard_stats(id,username,biggest_pull,packs_opened,xp_gained,win_streak,updated_at,is_deleted,upgrades_attempted) VALUES($1,$2,0,0,0,0,NOW(),FALSE,1) ON CONFLICT(id) DO UPDATE SET upgrades_attempted=COALESCE(leaderboard_stats.upgrades_attempted,0)+1,updated_at=NOW()`, [input.userId,user.username||user.display_name||'Trainer']);
    await client.query('COMMIT');
    return { success:true,isWin,winChance:Math.round(winChance*100)/100,wonCards,targetCards:targetCards.map(tc=>({cardId:tc.id,name:tc.card_name,rarity:tc.rarity,value:Number(tc.estimated_value),cardImageUrl:tc.card_image_url||null})),newBalance,removedCardIds:input.inventoryIds,nonce,rollValue,oddsVersionHash };
  } catch (err:any) {
    await client.query('ROLLBACK').catch(()=>undefined);
    return { success:false,error:err?.message||'Internal server error' };
  } finally { client.release(); }
}
