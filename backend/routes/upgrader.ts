/**
 * Upgrader Routes — win/loss determination is server-side only.
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';
import { sha256, computeRoll } from '../lib/provablyFair';

const app = new Hono();
const MAX_CHANCE_CHART: Record<number, number> = {1.2:70,1.5:55,2.0:35,3.0:35,4.0:35,5.0:15,6.0:15,7.0:15,8.0:8,9.0:8,10.0:8};

app.post('/upgrader/spin', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); }
  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json();
    const { inventoryIds, targetCardIds, useBalance, addedBalance, multiplier } = body;
    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) return c.json({ error: 'inventoryIds required' }, 400);
    if (!Array.isArray(targetCardIds) || targetCardIds.length === 0) return c.json({ error: 'targetCardIds required' }, 400);
    const serverSeed = (c.env as any).BLINK_SERVER_SEED;
    if (!serverSeed) return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    const seedRows = await blink.db.serverSeeds.list({ orderBy: { createdAt: 'desc' }, limit: 10 }) as any[];
    const matchingSeed = seedRows.find((r:any) => r.status === 'active' || r.status === 'pending');
    if (!matchingSeed) return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    const actualSeedHash = await sha256(serverSeed);
    if (!seedRows.some((r:any) => (r.status === 'active' || r.status === 'pending') && r.seedHash === actualSeedHash)) return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    const currentBalance = Number(user.balance || 0), currentMatched = Number(user.matchedBalance || user.matched_balance || 0), realBalance = Math.max(0, currentBalance - currentMatched);
    const allUserCards = await blink.db.inventory.list({ where: { userId } }) as any[];
    const userCardMap = Object.fromEntries(allUserCards.map((card:any) => [card.id, card]));
    for (const invId of inventoryIds) { const card=userCardMap[invId]; if (!card) return c.json({ error:`Card ${invId} not found in your inventory` },400); if (Number(card.isLocked)>0) return c.json({ error:`Card ${invId} is locked and cannot be used` },400); }
    const selectedCards = inventoryIds.map((id:string)=>userCardMap[id]);
    const selectedCardTotal = selectedCards.reduce((s:number, card:any)=>s+Number(card.value),0);
    const effectiveAddedBalance = useBalance ? Math.max(0, Number(addedBalance)||0) : 0;
    if (effectiveAddedBalance > realBalance) return c.json({ error:'Insufficient real balance for the added amount. Matched bonus funds cannot be used in the Upgrader.' },400);
    const totalUpgradeValue=selectedCardTotal+effectiveAddedBalance;
    if(totalUpgradeValue<0.5)return c.json({error:'Minimum upgrade value is $0.50'},400);
    const fetchedTargets=await blink.db.packCards.list({where:{id:{in:targetCardIds}}}) as any[];
    const targetMap=Object.fromEntries(fetchedTargets.map((card:any)=>[card.id,card]));
    const targetCards:any[]=[];
    for(const targetCardId of targetCardIds){const card=targetMap[targetCardId];if(!card)return c.json({error:`Target card ${targetCardId} not found`},400);targetCards.push(card);}
    const totalTargetVal=targetCards.reduce((s:number,card:any)=>s+Number(card.estimatedValue),0);
    if(totalTargetVal<=0)return c.json({error:'Target cards have no value'},400);
    let maxChanceLimit=MAX_CHANCE_CHART[multiplier]||75;
    try{const setting=await blink.db.upgraderMultiplierSettings.get(multiplier);if(setting)maxChanceLimit=Math.min(maxChanceLimit,Number((setting as any).maxChance));}catch{}
    const baselineTargetValue=totalUpgradeValue*multiplier;
    if(totalTargetVal<(baselineTargetValue-0.01))return c.json({error:`Target value ($${totalTargetVal.toFixed(2)}) must be at least $${baselineTargetValue.toFixed(2)} for ${multiplier}x multiplier.`},400);
    const calculatedFinalChance=maxChanceLimit*(baselineTargetValue/totalTargetVal),winChance=Math.min(maxChanceLimit,Math.max(0.1,calculatedFinalChance));
    const oddsSnapshot=JSON.stringify({multiplier,maxChanceLimit,baselineTargetValue:Math.round(baselineTargetValue*100)/100,totalTargetVal:Math.round(totalTargetVal*100)/100,totalUpgradeValue:Math.round(totalUpgradeValue*100)/100,effectiveAddedBalance:Math.round(effectiveAddedBalance*100)/100,selectedCardTotal:Math.round(selectedCardTotal*100)/100,winChance:Math.round(winChance*100)/100});
    const oddsVersionHash=await sha256(oddsSnapshot);
    let nonce=1;
    try{await blink.db.sql(`INSERT INTO user_nonces (user_id, upgrade_nonce) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET upgrade_nonce = upgrade_nonce + 1`,[userId]);const nonceRows=await blink.db.table('userNonces').list({where:{userId},limit:1}) as any[];if(!nonceRows.length)return c.json({error:'Provably fair system error — nonce read failed. Please try again.'},500);const dbNonce=nonceRows[0].upgradeNonce??nonceRows[0].upgrade_nonce;if(dbNonce===undefined||dbNonce===null)return c.json({error:'Provably fair system error — nonce read failed. Please try again.'},500);nonce=Number(dbNonce);}catch(nonceErr:any){console.error('[upgrader/spin] Nonce persistence failed:',nonceErr?.message);return c.json({error:'Provably fair system error — nonce persistence failed. Please try again.'},500);}
    const clientSeed=`cs_${uid()}`,rollValue=await computeRoll(serverSeed,clientSeed,nonce),isWin=rollValue<=winChance;
    await blink.db.inventory.deleteMany({where:{id:{in:inventoryIds}}});
    let newBalance=currentBalance;
    if(effectiveAddedBalance>0){const walletResult=await processWalletTransaction(blink,{userId,type:'upgrade',amount:-effectiveAddedBalance});if(!walletResult.success)return c.json({error:walletResult.error||'Failed to deduct balance'},500);newBalance=walletResult.balanceAfter;}
    const wonCards:any[]=[],isBot=user.isBot===true||Number(user.is_bot||0)>0,recipientId=getRewardUserId(userId,isBot);
    if(isWin){for(const tc of targetCards){const newInvId=`inv_${uid()}`;await blink.db.inventory.create({id:newInvId,userId:recipientId,cardId:tc.id,cardName:tc.cardName,rarity:tc.rarity,value:Number(tc.estimatedValue),emoji:'⭐',isFavorite:0,cardImageUrl:tc.cardImageUrl||null});wonCards.push({id:newInvId,cardId:tc.id,name:tc.cardName,rarity:tc.rarity,value:Number(tc.estimatedValue),emoji:'⭐',cardImageUrl:tc.cardImageUrl||null});}}
    else {try{const consolationPool=await blink.db.packCards.list({limit:500}) as any[];const pool=consolationPool.filter((card:any)=>{const v=Number(card.estimatedValue??card.estimated_value);return v>=0.02&&v<=0.07;});if(pool.length){const consolationRoll=await computeRoll(serverSeed,clientSeed+':consolation',nonce),consolationIndex=Math.floor((consolationRoll/100)*pool.length)%pool.length,rc=pool[consolationIndex];if(targetCardIds.includes(rc.id)||targetCardIds.includes(rc.cardId))throw new Error('Consolation prize conflict. Please try again.');const newInvId=`inv_${uid()}`;await blink.db.inventory.create({id:newInvId,userId:recipientId,cardId:rc.id,cardName:rc.cardName,rarity:rc.rarity,value:Number(rc.estimatedValue??rc.estimated_value),emoji:'🃏',isFavorite:0,cardImageUrl:rc.cardImageUrl||null});wonCards.push({id:newInvId,cardId:rc.id,name:rc.cardName,rarity:rc.rarity,value:Number(rc.estimatedValue??rc.estimated_value),emoji:'🃏',cardImageUrl:rc.cardImageUrl||null});}}catch(err:any){console.error('[Upgrader] Consolation award error:',err.message);wonCards.length=0;}}
    if(!isWin&&wonCards.some(c=>targetCardIds.includes(c.cardId)))return c.json({error:'Security violation detected in payout logic.'},500);
    try{await blink.db.table('upgraderSpins').create({id:`us_${uid()}`,userId,multiplier,totalInputValue:Math.round(totalUpgradeValue*100)/100,balanceUsed:Math.round(effectiveAddedBalance*100)/100,baselineTargetValue:Math.round(baselineTargetValue*100)/100,totalTargetValue:Math.round(totalTargetVal*100)/100,winChance:Math.round(winChance*100)/100,isWin:isWin?1:0,clientSeed,nonce,rollValue:Math.round(rollValue*10000)/10000,serverSeedHash:actualSeedHash,oddsVersionHash,wonCardsJson:JSON.stringify(wonCards),removedCardIdsJson:JSON.stringify(inventoryIds),provablyFair:1});}catch{}
    try{await blink.db.transactions.create({id:`txn_${uid()}`,userId,type:'upgrade',amount:isWin?totalTargetVal-totalUpgradeValue:-totalUpgradeValue,description:isWin?`Upgrade WIN: ${targetCards.map((c:any)=>c.cardName).join(', ')}`:'Upgrade FAIL (Consolation awarded)'});}catch{}
    try{const lsRows=await blink.db.leaderboardStats.list({where:{id:userId}}) as any[];if(lsRows[0])await blink.db.leaderboardStats.update(lsRows[0].id,{upgradesAttempted:Number(lsRows[0].upgradesAttempted||0)+1,updatedAt:new Date().toISOString()});else await blink.db.leaderboardStats.create({id:userId,username:user.username||user.displayName||'Trainer',biggestPull:0,packsOpened:0,winStreak:0,upgradesAttempted:1,updatedAt:new Date().toISOString()});}catch{}
    try{await writeLog(blink,{type:'upgrade',userId,username:user.username||user.displayName||'Trainer',action:isWin?'Upgrade WIN':'Upgrade LOSS',details:{cardsUsed:selectedCards.map((card:any)=>({name:card.cardName,value:Number(card.value),rarity:card.rarity})),targetCards:targetCards.map((card:any)=>({name:card.cardName,value:Number(card.estimatedValue),rarity:card.rarity})),prizeReceived:wonCards.map((card:any)=>({name:card.name,value:card.value,rarity:card.rarity})),winChance:Math.round(winChance*100)/100,balanceUsed:effectiveAddedBalance},valueIn:totalUpgradeValue,valueOut:isWin?totalTargetVal:(wonCards[0]?.value||0),result:isWin?'win':'loss'});}catch{}
    return c.json({success:true,isWin,winChance:Math.round(winChance*100)/100,wonCards,targetCards:targetCards.map(tc=>({cardId:tc.id,name:tc.cardName,rarity:tc.rarity,value:Number(tc.estimatedValue),cardImageUrl:tc.cardImageUrl||null})),newBalance,removedCardIds:inventoryIds});
  } catch(err:any){console.error('[upgrader/spin] error:',err.message);return c.json({error:err.message||'Internal server error'},500);}
});
export default app;
