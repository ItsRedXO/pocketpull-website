import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { setInventoryFlag } from '../repositories/inventory';
import { transaction } from '../lib/postgres';
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
      if(Number(card.sold||0)!==0)return {kind:'sold' as const};
      if(Number(card.locked||0)!==0)throw new Error('Card is locked');
      const value=Number(card.value||0);
      if(!Number.isFinite(value)||value<0)throw new Error('Invalid card value');

      const wallet=await processWalletTransactionInClient(client,{userId,type:'sell',amount:value,sourceId:inventoryId});
      if(!wallet.success)throw new Error(wallet.error||'Failed to credit wallet');

      const updated=await client.query('UPDATE inventory SET sold=1 WHERE id=$1 AND user_id=$2 AND COALESCE(sold,0)=0',[inventoryId,userId]);
      if(updated.rowCount!==1)throw new Error('Card could not be marked sold');

      const data=card.data&&typeof card.data==='object'?card.data:{};
      const cardName=data.cardName||data.card_name||data.name||'Card';
      const imageUrl=data.cardImageUrl||data.card_image_url||data.imageUrl||data.image_url||'';
      const description=`Sold ${cardName}${imageUrl?` |img:${imageUrl}|`:''}`;
      try{
        await client.query('INSERT INTO transactions(id,user_id,type,amount,description,source_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',[`txn_sell_${inventoryId}`,userId,'sell',value,description,inventoryId]);
      }catch(historyError){
        console.error('[inventory/sell] history insert failed; sale retained',historyError);
      }
      return {kind:'ok' as const,value,balance:wallet.balanceAfter};
    });
    if(result.kind==='not_found')return c.json({error:'Card not found'},404);
    if(result.kind==='sold')return c.json({error:'Card already sold'},409);
    return c.json({success:true,inventoryId,soldCardId:inventoryId,value:result.value,cardValue:result.value,balance:result.balance,newBalance:result.balance});
  }catch(e:any){console.error('[inventory/sell]',e);return c.json({error:e.message||'Failed to sell card'},400);}
});

app.post('/inventory/sell-all',async c=>{
  const userId=await auth(c);if(typeof userId!=='string')return userId;
  try{
    const result=await transaction(async client=>{
      const cards=await client.query('SELECT * FROM inventory WHERE user_id=$1 AND COALESCE(sold,0)=0 AND COALESCE(locked,0)=0 FOR UPDATE',[userId]);
      if(!cards.rowCount)return null;
      const total=cards.rows.reduce((s:number,r:any)=>s+Number(r.value||0),0);
      const ids=cards.rows.map((r:any)=>r.id);
      const sourceId=`sellall_${ids.join('_').slice(0,80)}`;
      const wallet=await processWalletTransactionInClient(client,{userId,type:'sell_all',amount:total,sourceId});
      if(!wallet.success)throw new Error(wallet.error||'Failed to credit wallet');
      const updated=await client.query('UPDATE inventory SET sold=1 WHERE user_id=$1 AND id=ANY($2::text[]) AND COALESCE(sold,0)=0',[userId,ids]);
      if(updated.rowCount!==cards.rowCount)throw new Error('Some cards could not be marked sold');
      for(const card of cards.rows){
        const data=card.data&&typeof card.data==='object'?card.data:{};
        const cardName=data.cardName||data.card_name||data.name||'Card';
        const imageUrl=data.cardImageUrl||data.card_image_url||data.imageUrl||data.image_url||'';
        const description=`Sold ${cardName}${imageUrl?` |img:${imageUrl}|`:''}`;
        try{await client.query('INSERT INTO transactions(id,user_id,type,amount,description,source_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',[`txn_sell_${card.id}`,userId,'sell',Number(card.value||0),description,card.id]);}catch(historyError){console.error('[inventory/sell-all] history insert failed; sale retained',historyError);}
      }
      return {balance:wallet.balanceAfter,ids,total,count:cards.rowCount};
    });
    if(!result)return c.json({error:'No unlocked cards to sell'},400);
    return c.json({success:true,newBalance:result.balance,soldCardIds:result.ids,totalValue:result.total,count:result.count});
  }catch(e:any){console.error('[inventory/sell-all]',e);return c.json({error:e.message||'Failed to sell cards'},400);}
});

export default app;
