import { randomUUID } from 'node:crypto';
import { getDb, type DbEnv } from '../client';

const RARITY_EMOJIS: Record<string, string> = { common:'🃏', uncommon:'🌿', rare:'💧', ultra:'🌙', secret:'⭐', god:'🌈' };

export async function exchangeCards(env: DbEnv, userId: string, offerIds: string[], receiveIds: string[]) {
  const db = getDb(env); const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(`SELECT id,username,display_name,balance,matched_balance,is_deleted,is_banned,is_bot FROM users WHERE id=$1 FOR UPDATE`, [userId]);
    const user = userRes.rows[0];
    if (!user) return await fail(client, 'User not found');
    if (user.is_deleted) return await fail(client, 'Account deactivated');
    if (user.is_banned) return await fail(client, 'Account banned');

    const offeredRes = await client.query(`SELECT id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,card_image_url,pack_name,is_locked FROM inventory WHERE user_id=$1 AND id=ANY($2::text[]) FOR UPDATE`, [userId, offerIds]);
    const offeredMap = new Map(offeredRes.rows.map(r=>[r.id,r]));
    const offered:any[]=[];
    for (const id of offerIds) { const card=offeredMap.get(id); if(!card) return await fail(client,`Card ${id} not in your inventory`); if(card.is_locked) return await fail(client,`Card ${id} is locked`); offered.push(card); }

    const receiveRes = await client.query(`SELECT id,card_name,rarity,estimated_value,card_image_url FROM pack_cards WHERE id=ANY($1::text[])`, [receiveIds]);
    const receiveMap = new Map(receiveRes.rows.map(r=>[r.id,r])); const receive:any[]=[];
    for (const id of receiveIds) { const card=receiveMap.get(id); if(!card) return await fail(client,`Market card ${id} not found`); receive.push(card); }

    const offerTotal=offered.reduce((s,c)=>s+Number(c.value||0),0); const receiveTotal=receive.reduce((s,c)=>s+Number(c.estimated_value||0),0);
    if(receiveTotal>offerTotal+0.001) return await fail(client,`Cannot receive more than offered. Offer: $${offerTotal.toFixed(2)}, Receive: $${receiveTotal.toFixed(2)}`);
    const refund=Math.max(0,offerTotal-receiveTotal);
    await client.query(`DELETE FROM inventory WHERE user_id=$1 AND id=ANY($2::text[])`,[userId,offerIds]);

    const added:any[]=[];
    for(const pc of receive){ const id=`inv_${randomUUID().replaceAll('-','').slice(0,20)}`; await client.query(`INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,created_at,card_image_url,pack_name,is_locked,battle_id) VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,NOW(),$8,NULL,FALSE,NULL)`,[id,userId,pc.id,pc.card_name,pc.rarity,Number(pc.estimated_value),RARITY_EMOJIS[pc.rarity]||'🃏',pc.card_image_url||null]); added.push({id,userId,cardId:pc.id,cardName:pc.card_name,rarity:pc.rarity,value:Number(pc.estimated_value),emoji:RARITY_EMOJIS[pc.rarity]||'🃏',isFavorite:false,cardImageUrl:pc.card_image_url||null,packName:null,name:pc.card_name,isLocked:false}); }

    const balance=Number(user.balance||0), newBalance=balance+refund;
    if(refund>0.01){ await client.query(`UPDATE users SET balance=$2,updated_at=NOW() WHERE id=$1`,[userId,newBalance]); const source=`exchange_${userId}_${offerIds.join(',').slice(0,60)}`; await client.query(`INSERT INTO wallet_transactions(id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES($1,$2,'exchange_refund',$3,$4,$5,$6,$6,$7,$8::jsonb,NOW()) ON CONFLICT(id) DO NOTHING`,[`wt_${randomUUID()}`,userId,refund,balance,newBalance,Number(user.matched_balance||0),source,JSON.stringify({offerTotal,receiveTotal})]); }
    await client.query(`INSERT INTO transactions(id,user_id,type,amount,description,created_at) VALUES($1,$2,'exchange',$3,$4,NOW())`,[`txn_${randomUUID()}`,userId,'-'+offerTotal,`Exchanged ${offered.length} card(s) for ${receive.length} card(s)`]);
    if(refund>0.01) await client.query(`INSERT INTO transactions(id,user_id,type,amount,description,created_at) VALUES($1,$2,'exchange_refund',$3,$4,NOW())`,[`txn_${randomUUID()}`,userId,refund,`Exchange refund — traded ${offerTotal.toFixed(2)} for ${receiveTotal.toFixed(2)} in cards`]);
    await client.query('COMMIT'); return {success:true,removedCardIds:offerIds,addedCards:added,refund,newBalance};
  }catch(err:any){await client.query('ROLLBACK').catch(()=>{}); return {success:false,error:err?.message||'Internal server error'};}finally{client.release();}
}
async function fail(client:any,error:string){await client.query('ROLLBACK'); return {success:false,error};}
