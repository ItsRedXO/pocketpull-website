import { randomUUID } from 'node:crypto';
import { getDb, type DbEnv } from '../client';
import { computeRoll, sha256, buildOddsSnapshot, selectCardIndex } from '../../lib/provablyFair';

const RARITY_EMOJIS: Record<string,string>={common:'🃏',uncommon:'🌿',rare:'💧',ultra:'🌙',secret:'⭐',god:'🌈'};
const id=(p:string)=>`${p}_${randomUUID().replaceAll('-','').slice(0,20)}`;
type BattleResult={playerId:string;userId:string;username:string;avatar:string;isAi:boolean;cards:any[];totalValue:number;isWinner:boolean;teamSide:string|null};

export async function executeBattle(env:DbEnv,battleId:string,serverSeed:string){
 const client=await getDb(env).connect();
 try{
  await client.query('BEGIN');
  const bq=await client.query(`SELECT * FROM battles WHERE id=$1 FOR UPDATE`,[battleId]); const battle=bq.rows[0];
  if(!battle){await client.query('ROLLBACK');return {success:false,error:'Battle not found',status:404};}
  if(battle.status==='finished'){await client.query('ROLLBACK');return {success:false,error:'Battle already finished',status:409};}
  const actualHash=await sha256(serverSeed); const sq=await client.query(`SELECT id,seed_hash,status FROM server_seeds WHERE seed_hash=$1 AND status IN ('active','pending') ORDER BY created_at DESC LIMIT 1`,[actualHash]);
  if(!sq.rows[0]){await client.query('ROLLBACK');return {success:false,error:'Provably fair integrity error. Please contact support.',status:500};}
  const playersQ=await client.query(`SELECT * FROM battle_players WHERE battle_id=$1 ORDER BY joined_at ASC FOR UPDATE`,[battleId]); const players=playersQ.rows;
  if(!players.length){await client.query('ROLLBACK');return {success:false,error:'Battle has no players',status:400};}
  const packs=JSON.parse(battle.packs_json||'[]'); const packIds=[...new Set(packs.map((p:any)=>p.id))] as string[];
  const cardsQ=await client.query(`SELECT * FROM pack_cards WHERE pack_id=ANY($1::text[]) ORDER BY id`,[packIds]);
  const cardMap=new Map<string,any[]>(); for(const pid of packIds) cardMap.set(pid,cardsQ.rows.filter(c=>c.pack_id===pid));
  const oddsHashes:Record<string,string>={};
  for(const pid of packIds){const pool=cardMap.get(pid)||[];if(pool.length){oddsHashes[pid]=await sha256(buildOddsSnapshot(pool));}}
  await client.query(`UPDATE battles SET status='live',started_at=COALESCE(started_at,NOW()),is_spinning=1 WHERE id=$1`,[battleId]);
  const results:BattleResult[]=[]; let pullIndex=0;
  for(const p of players){const cards:any[]=[]; const ai=Boolean(p.is_ai||p.isAi); const userId=p.user_id;
   for(const pack of packs){pullIndex++; const pool=cardMap.get(pack.id)||[]; if(!pool.length)continue;
    const nonceQ=ai?null:await client.query(`INSERT INTO user_nonces(user_id,pack_nonce,upgrade_nonce) VALUES($1,1,0) ON CONFLICT(user_id) DO UPDATE SET pack_nonce=user_nonces.pack_nonce+1 RETURNING pack_nonce`,[userId]);
    const nonce=ai?pullIndex:Number(nonceQ?.rows[0]?.pack_nonce); const clientSeed=`cs_bt_${battleId}_${p.id}_${pullIndex}`; const roll=await computeRoll(serverSeed,clientSeed,nonce); const cardIndex=selectCardIndex(roll,pool); const raw=pool[cardIndex];
    const rarity=raw.rarity||'common'; const card={id:id('po'),cardId:raw.id,name:raw.card_name,rarity,value:Number(raw.estimated_value||0),imageUrl:raw.card_image_url||null,packId:pack.id,packName:pack.name,emoji:RARITY_EMOJIS[rarity]||'🃏',clientSeed,nonce,rollValue:roll,serverSeedHash:actualHash,oddsVersionHash:oddsHashes[pack.id]||'',isBot:ai}; cards.push(card);
    await client.query(`INSERT INTO battle_pull_audits(id,battle_id,battle_player_id,user_id,pack_id,pack_name,card_name,rarity,cost,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,is_bot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,[id('bpa'),battleId,p.id,userId,pack.id,pack.name,card.name,rarity,Number(pack.price||0),clientSeed,nonce,roll,actualHash,oddsHashes[pack.id]||'',ai]);
    if(!ai) await client.query(`INSERT INTO packs_opened(id,user_id,pack_id,pack_name,cost,created_at,card_name,rarity,client_seed,nonce,roll_value,odds_version_hash,server_seed_hash,provably_fair) VALUES($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9,$10,$11,$12,TRUE)`,[id('po'),userId,pack.id,pack.name,Number(pack.price||0),card.name,rarity,clientSeed,nonce,roll,oddsHashes[pack.id]||'',actualHash]);
   }
   const total=Math.round(cards.reduce((s,c)=>s+c.value,0)*100)/100; results.push({playerId:p.id,userId,username:p.username,avatar:p.avatar,isAi:ai,cards,totalValue:total,isWinner:false,teamSide:p.team_side||null});
  }
  const mode=battle.mode||'standard'; const teamMode=Number(battle.team_mode||0)>0; let winner:BattleResult|null=null; let draw=false;
  if(mode==='shared'){results.forEach(r=>r.isWinner=true);}
  else if(teamMode){const left=results.filter(r=>r.teamSide==='left').reduce((s,r)=>s+r.totalValue,0);const right=results.filter(r=>r.teamSide==='right').reduce((s,r)=>s+r.totalValue,0);if(Math.round(left*100)===Math.round(right*100))draw=true;else{const side=left>right?'left':'right';results.forEach(r=>r.isWinner=r.teamSide===side);winner=results.find(r=>r.teamSide===side)||null;}}
  else {const max=Math.max(...results.map(r=>r.totalValue));const top=results.filter(r=>Math.round(r.totalValue*100)===Math.round(max*100));if(top.length===1){winner=top[0];winner.isWinner=true;}else draw=true;}
  const winningHumans=results.filter(r=>r.isWinner&&!r.isAi); let rewardIndex=0;
  for(const r of results){await client.query(`UPDATE battle_players SET cards_json=$2::jsonb,total_value=$3,is_winner=$4 WHERE id=$1`,[r.playerId,JSON.stringify(r.cards),r.totalValue,r.isWinner]);
   for(const card of r.cards){let recipient:BattleResult|null=null;if(mode==='shared'||draw)recipient=r;else if(teamMode)recipient=winningHumans.length?winningHumans[rewardIndex++%winningHumans.length]:null;else recipient=winner;
    if(recipient&&!recipient.isAi)await client.query(`INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,created_at,card_image_url,pack_name,is_locked,battle_id) VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,NOW(),$8,$9,FALSE,$10)`,[id('inv'),recipient.userId,card.cardId,card.name,card.rarity,card.value,card.emoji,card.imageUrl,card.packName,battleId]);
   }
  }
  if(!draw&&mode!=='shared'&&winner&&!winner.isAi){await client.query(`INSERT INTO leaderboard_stats(id,username,biggest_pull,packs_opened,xp_gained,win_streak,updated_at,is_deleted,upgrades_attempted) VALUES($1,$2,$3,$4,0,0,NOW(),FALSE,0) ON CONFLICT(id) DO UPDATE SET biggest_pull=GREATEST(COALESCE(leaderboard_stats.biggest_pull,0),EXCLUDED.biggest_pull),packs_opened=COALESCE(leaderboard_stats.packs_opened,0)+EXCLUDED.packs_opened,updated_at=NOW()`,[winner.userId,winner.username,winner.totalValue,packs.length]);}
  if(teamMode&&winner&&!draw){const winners=results.filter(r=>r.isWinner&&!r.isAi);const pot=Number(battle.total_cost||0)*players.length;const share=pot/Math.max(winners.length,1);for(const r of winners){const uq=await client.query(`SELECT balance,matched_balance FROM users WHERE id=$1 FOR UPDATE`,[r.userId]);const before=uq.rows[0];if(!before)continue;const nb=Number(before.balance||0)+share;await client.query(`UPDATE users SET balance=$2,updated_at=NOW() WHERE id=$1`,[r.userId,nb]);await client.query(`INSERT INTO wallet_transactions(id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES($1,$2,'battle_team_reward',$3,$4,$5,$6,$6,$7,$8::jsonb,NOW())`,[id('wt'),r.userId,share,Number(before.balance||0),nb,Number(before.matched_balance||0),`${battleId}_${r.teamSide}`,JSON.stringify({teamSide:r.teamSide,teamPot:pot,share})]);}}
  await client.query(`INSERT INTO battle_results(id,battle_id,winner_user_id,winner_username,total_pot,mode,ended_at) VALUES($1,$2,$3,$4,$5,$6,NOW())`,[id('br'),battleId,winner?.userId||null,winner?.username||null,Number(battle.total_cost||0)*players.length,mode]);
  await client.query(`UPDATE battles SET status='finished',ended_at=NOW(),is_spinning=0,winner_user_id=$2,winner_username=$3 WHERE id=$1`,[battleId,winner?.userId||null,winner?.username||null]);
  await client.query('COMMIT'); return {success:true,playerResults:results,winner,isDraw:draw};
 }catch(e:any){await client.query('ROLLBACK').catch(()=>{});return {success:false,error:e?.message||'Internal server error',status:500};}finally{client.release();}
}
