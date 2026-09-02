/** Pack opening is fully server-authoritative and PostgreSQL-backed. */
import { Hono } from 'hono';
import { requireAuth, uid, getRewardUserId } from '../lib/auth';
import { query, transaction } from '../lib/postgres';
import { writeLog } from './logs';
import { processWalletTransaction } from '../repositories/wallet';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../lib/provablyFair';

const app = new Hono();
const RARITY_EMOJIS: Record<string, string> = { common:'🃏', uncommon:'🌿', rare:'💧', ultra:'🌙', secret:'⭐', god:'🌈', chase:'🔥', premium:'✨', base:'🃏' };
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

app.post('/open-pack', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) { return c.json({ error: err?.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err?.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }
  try {
    const { packId } = await c.req.json().catch(() => ({}));
    if (!packId) return c.json({ error: 'packId required' }, 400);
    const [packRows, userRows] = await Promise.all([query('SELECT * FROM packs_catalog WHERE id=$1 LIMIT 1', [packId]), query('SELECT * FROM users WHERE id=$1 LIMIT 1', [userId])]);
    const pack: any = packRows[0], user: any = userRows[0];
    if (!pack || !num(pack.is_active, 0)) return c.json({ error: 'Pack not found or inactive' }, 404);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (num(user.is_deleted) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (num(user.is_banned) > 0) return c.json({ error: 'Account banned' }, 403);
    const price = num(pack.price);
    if (pack.expires_at && new Date(pack.expires_at) < new Date()) return c.json({ error: 'This pack has expired' }, 400);
    const quantityLimit = num(pack.quantity_limit), currentQuantity = num(pack.current_quantity);
    if (quantityLimit > 0 && currentQuantity <= 0) return c.json({ error: 'Pack is sold out' }, 400);
    const cooldownHours = num(pack.cooldown_hours);
    if (cooldownHours > 0) {
      const rows = await query('SELECT last_opened_at FROM pack_cooldowns WHERE user_id=$1 AND pack_id=$2', [userId, packId]);
      if (rows[0]?.last_opened_at) { const diff=(Date.now()-new Date(rows[0].last_opened_at).getTime())/3600000; if (diff<cooldownHours) return c.json({ error:`Cooldown active: ${Math.ceil(cooldownHours-diff)}h remaining` },400); }
    }
    const spendable=num(user.balance)+num(user.matched_balance);
    if (price>spendable) return c.json({ error:`Insufficient balance. Need ${price.toFixed(2)}, have ${spendable.toFixed(2)}` },400);
    const isMysteryPack=(pack.pack_type||'standard')==='mystery';
    let cards:any[]=await query('SELECT * FROM pack_cards WHERE pack_id=$1 ORDER BY sort_order ASC, id ASC',[packId]);
    if(isMysteryPack)cards=cards.filter(card=>num(card.quantity)>0);
    cards=cards.map(card=>({...card,cardName:card.card_name||card.name||'Unknown Card',estimatedValue:num(card.estimated_value??card.value),cardImageUrl:card.card_image_url||card.image_url||null,pullChance:isMysteryPack?0:num(card.pull_chance??card.odds)}));
    if(isMysteryPack){const totalUnits=cards.reduce((sum,card)=>sum+num(card.quantity),0);cards=cards.map(card=>({...card,pullChance:totalUnits>0?(num(card.quantity)/totalUnits)*100:0}));}
    if(!cards.length)return c.json({error:isMysteryPack?'This Mystery Pack is sold out':'No cards configured for this pack'},400);
    const serverSeed=(c.env as any).BLINK_SERVER_SEED;
    if(!serverSeed)return c.json({error:'Provably fair system not initialized. Please contact support.'},500);
    const seedHash=await sha256(serverSeed);
    const seedRows=await query("SELECT * FROM server_seeds WHERE (status IN ('active','pending') OR active=1) ORDER BY created_at DESC LIMIT 10");
    if(!seedRows.some((s:any)=>s.seed_hash===seedHash))return c.json({error:'Provably fair integrity error. Please contact support.'},500);
    const oddsJson=buildOddsSnapshot(cards),oddsVersionHash=await sha256(oddsJson);
    await query(`INSERT INTO pack_odds_versions(id,pack_id,version,hash,snapshot,content_hash,odds_json,card_count) VALUES($1,$2,COALESCE((SELECT MAX(version)+1 FROM pack_odds_versions WHERE pack_id=$2),1),$3,$4::jsonb,$3,$4::jsonb,$5) ON CONFLICT (pack_id,version) DO UPDATE SET hash=EXCLUDED.hash,snapshot=EXCLUDED.snapshot,content_hash=EXCLUDED.content_hash,odds_json=EXCLUDED.odds_json,card_count=EXCLUDED.card_count`,[`pov_${uid()}`,packId,oddsVersionHash,oddsJson,cards.length]);
    const nonceRows=await query('INSERT INTO user_nonces(user_id,nonce,updated_at) VALUES($1,1,now()) ON CONFLICT(user_id) DO UPDATE SET nonce=user_nonces.nonce+1,updated_at=now() RETURNING nonce',[userId]);
    const nonce=num(nonceRows[0]?.nonce); if(!nonce)return c.json({error:'Provably fair system error — nonce persistence failed. Please try again.'},500);
    const clientSeed=`cs_${uid()}`,rollValue=await computeRoll(serverSeed,clientSeed,nonce),cardIndex=selectCardIndex(rollValue,cards),picked:any=cards[cardIndex];
    if(!picked)return c.json({error:'Card selection failed'},500);
    if(isMysteryPack){const claimed=await query('UPDATE pack_cards SET quantity=quantity-1 WHERE id=$1 AND quantity>0 RETURNING id',[picked.id]);if(!claimed.length)return c.json({error:'That Mystery Pack card just sold out. Please try again.'},409);await query('UPDATE packs_catalog SET current_quantity=(SELECT COALESCE(SUM(quantity),0) FROM pack_cards WHERE pack_id=$1) WHERE id=$1',[packId]);}
    else if(quantityLimit>0){const updated=await query('UPDATE packs_catalog SET current_quantity=GREATEST(current_quantity-1,0) WHERE id=$1 AND current_quantity>0 RETURNING current_quantity',[packId]);if(!updated.length)return c.json({error:'Pack is sold out'},409);}
    const cardName=picked.cardName,rarity=picked.rarity||'common',cardValue=num(picked.estimatedValue),cardImageUrl=picked.cardImageUrl,cardId=`${cardName.toLowerCase().replace(/\s+/g,'_')}_${rarity}`,isBot=user.is_bot===1||user.is_bot===true,recipientId=getRewardUserId(userId,isBot),inventoryId=`inv_${uid()}`;
    await query(`INSERT INTO inventory(id,user_id,card_id,pack_id,value,locked,favorite,sold,created_at,card_name,rarity,emoji,card_image_url,pack_name,is_locked,is_favorite) VALUES($1,$2,$3,$4,$5,0,0,0,now(),$6,$7,$8,$9,$10,0,0)`,[inventoryId,recipientId,cardId,packId,cardValue,cardName,rarity,RARITY_EMOJIS[rarity]||'🃏',cardImageUrl,pack.name]);
    const walletResult=await processWalletTransaction({userId,type:'pack_open',amount:-price,matchedAmount:num(user.matched_balance),sourceId:inventoryId,metadata:{packId,packName:pack.name,cardName,rarity}});
    if(!walletResult.success){await query('DELETE FROM inventory WHERE id=$1',[inventoryId]);return c.json({error:`Failed to deduct balance: ${walletResult.error}`},400);}
    await Promise.allSettled([
      query('INSERT INTO pack_cooldowns(user_id,pack_id,last_opened_at) VALUES($1,$2,now()) ON CONFLICT(user_id,pack_id) DO UPDATE SET last_opened_at=EXCLUDED.last_opened_at',[userId,packId]),
      query(`INSERT INTO packs_opened(id,user_id,pack_id,inventory_id,pack_name,cost,card_name,rarity,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,provably_fair) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1)`,[`po_${uid()}`,userId,packId,inventoryId,pack.name,price,cardName,rarity,clientSeed,nonce,rollValue,seedHash,oddsVersionHash]),
      query(`INSERT INTO transactions(id,user_id,type,amount,matched_amount,description,source_id) VALUES($1,$2,'pack_open',$3,0,$4,$5)`,[`txn_${uid()}`,userId,-price,`Opened ${pack.name} — pulled ${cardName} (inv:${inventoryId})`,inventoryId]),
      query(`INSERT INTO leaderboard_stats(id,username,biggest_pull,packs_opened,updated_at) VALUES($1,$2,$3,1,now()) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username,biggest_pull=GREATEST(leaderboard_stats.biggest_pull,EXCLUDED.biggest_pull),packs_opened=leaderboard_stats.packs_opened+1,updated_at=now()`,[userId,user.username||user.display_name||'Trainer',cardValue]),
      writeLog(null,{type:'pack_open',userId,username:user.username||user.display_name||'Trainer',action:`Opened ${pack.name}`,details:{packName:pack.name,packCost:price,cardWon:cardName,cardValue,rarity,packId,inventoryId},valueIn:price,valueOut:cardValue,result:'pulled'}),
    ]);
    return c.json({success:true,card:{name:cardName,rarity,value:cardValue,emoji:RARITY_EMOJIS[rarity]||'🃏',imageUrl:cardImageUrl},inventoryId,newBalance:walletResult.balanceAfter,newMatchedBalance:walletResult.matchedAfter});
  }catch(err:any){console.error('[open-pack] error:',err?.message||err);return c.json({error:err?.message||'Internal server error'},500);}
});
export default app;
