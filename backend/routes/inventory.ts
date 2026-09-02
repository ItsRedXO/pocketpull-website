import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { setInventoryFlag } from '../repositories/inventory';
import { query, transaction } from '../lib/postgres';
import { processWalletTransactionInClient } from '../repositories/wallet';

const app = new Hono();
async function auth(c:any){try{return await requireAuth(c);}catch(e:any){if(e.message==='ACCOUNT_DEACTIVATED')return c.json({error:'Account deactivated'},403);return c.json({error:'Authentication required'},401);}}

app.post('/inventory/lock',async c=>{const userId=await auth(c);if(typeof userId!=='string')return userId;const {inventoryId,isLocked}=await c.req.json().catch(()=>({}));if(!inventoryId||typeof isLocked!=='boolean')return c.json({error:'inventoryId and isLocked (boolean) required'},400);const row=await setInventoryFlag(inventoryId,userId,'locked',isLocked);if(!row)return c.json({error:'Card not found or not owned'},404);return c.json({success:true,inventoryId,isLocked});});
app.post('/inventory/favorite',async c=>{const userId=await auth(c);if(typeof userId!=='string')return userId;const {inventoryId,isFavorite}=await c.req.json().catch(()=>({}));if(!inventoryId||typeof isFavorite!=='boolean')return c.json({error:'inventoryId and isFavorite (boolean) required'},400);const row=await setInventoryFlag(inventoryId,userId,'favorite',isFavorite);if(!row)return c.json({error:'Card not found or not owned'},404);return c.json({success:true,inventoryId,isFavorite});});

app.post('/inventory/sell',async c=>{
  const userId=await auth(c);if(typeof userId!=='string')return userId;
  const {inventoryId}=await c.req.json().catch(()=>({}));if(!inventoryId)return c.json({error:'inventoryId required'},400);
  try{
    const result=await transaction(async client=>{
      const rows=await client.query('SELECT * FROM inventory WHERE id=$1 AND user_id=$2 FOR UPDATE',[inventoryId,userId]);
      if(!rows.rowCount)return {kind:'not_found' as const};
      const card=rows.rows[0];
      if(Number(card.sold))return {kind:'sold' as const};
      if(Number(card.locked || card.is_locked || 0))throw new Error('Card is locked');
      const value=Number(card.value||0);
      await client.query('UPDATE inventory SET sold=1 WHERE id=$1 AND user_id=$2 AND sold=0',[inventoryId,userId]);
      const wallet=await processWalletTransactionInClient(client,{userId,type:'sell',amount:value,sourceId:inventoryId});
      if(!wallet.success)throw new Error(wallet.error||'Failed to credit wallet');
      await client.query('INSERT INTO transactions(id,user_id,type,amount,description,source_id) VALUES($1,$2,$3,$4,$5,$6)',[`txn_${Date.now().toString(36)}`,userId,'sell',value,`Sold ${card.card_name || card.cardName || 'Card'}`,inventoryId]);
      return {kind:'ok' as const,value,balance:wallet.balanceAfter};
    });
    if(result.kind==='not_found')return c.json({error:'Card not found'},404);
    if(result.kind==='sold')return c.json({error:'Card already sold'},409);
    return c.json({success:true,inventoryId,value:result.value,balance:result.balance});
  }catch(e:any){return c.json({error:e.message||'Failed to sell card'},400);}
});

app.post('/inventory/sell-all',async c=>{
  const userId=await auth(c);if(typeof userId!=='string')return userId;
  try{
    const result=await transaction(async client=>{
      const cards=await client.query('SELECT * FROM inventory WHERE user_id=$1 AND sold=0 AND COALESCE(is_locked,locked,0)=0 FOR UPDATE',[userId]);
      if(!cards.rowCount)return null;
      const total=cards.rows.reduce((s:number,r:any)=>s+Number(r.value||0),0);
      const ids=cards.rows.map((r:any)=>r.id);
      const sourceId=`sellall_${ids.join('_').slice(0,80)}`;
      await client.query('UPDATE inventory SET sold=1 WHERE user_id=$1 AND id=ANY($2::text[]) AND sold=0',[userId,ids]);
      const wallet=await processWalletTransactionInClient(client,{userId,type:'sell_all',amount:total,sourceId});
      if(!wallet.success)throw new Error(wallet.error||'Failed to credit wallet');
      await client.query('INSERT INTO transactions(id,user_id,type,amount,description,source_id) VALUES($1,$2,$3,$4,$5,$6)',[`txn_${Date.now().toString(36)}`,userId,'sell_all',total,`Sold all ${cards.rowCount} unlocked cards`,sourceId]);
      return {balance:wallet.balanceAfter,ids,total,count:cards.rowCount};
    });
    if(!result)return c.json({error:'No unlocked cards to sell'},400);
    return c.json({success:true,newBalance:result.balance,soldCardIds:result.ids,totalValue:result.total,count:result.count});
  }catch(e:any){return c.json({error:e.message||'Failed to sell cards'},400);}
});

export default app;
