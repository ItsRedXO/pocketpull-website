import { transaction } from './postgres';
import { processWalletTransactionInClient } from '../repositories/wallet';

export async function processFirstDepositBonus(_blink:any,userId:string,depositAmt:number){
  try{return await transaction(async client=>{
    const r=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId]);
    if(!r.rowCount)return;
    const user:any=r.rows[0];
    if(Number(user.first_deposit_bonus_paid||0)>0)return;
    const id=`txn_first_deposit_bonus_${userId}`;
    if((await client.query('SELECT 1 FROM transactions WHERE id=$1',[id])).rowCount){await client.query('UPDATE users SET first_deposit_bonus_paid=1,updated_at=now() WHERE id=$1',[userId]);return;}
    const bonus=Math.min(Number(depositAmt)||0,100);
    if(bonus<=0)return;
    const wallet=await processWalletTransactionInClient(client,{userId,type:'first_deposit_bonus',amount:bonus,matchedAmount:bonus,sourceId:id});
    if(!wallet.success)throw new Error(wallet.error||'Failed to issue first deposit bonus');
    await client.query("INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,'first_deposit_bonus',$3,$4,$5,now())",[id,userId,bonus,`First Deposit Bonus — 100% match (Matched funds) (Deposited ${Number(depositAmt).toFixed(2)}, earned ${bonus.toFixed(2)})`,id]);
    await client.query('UPDATE users SET first_deposit_bonus_paid=1,updated_at=now() WHERE id=$1',[userId]);
    return {success:true,bonus};
  });}catch(e){console.error('[FirstDeposit]',e);return {success:false};}
}

export async function processReferralReward(_blink:any,userId:string,referrerId:string,depositAmt:number){
  try{return await transaction(async client=>{
    if(Number(depositAmt)<5)return;
    const ur=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId]);
    const rr=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[referrerId]);
    if(!ur.rowCount||!rr.rowCount)return;
    const user:any=ur.rows[0];
    if(Number(user.referral_reward_paid||0)>0)return;
    const id=`txn_referral_reward_${userId}_v3`, referredId=`txn_referral_referred_bonus_${userId}_v1`;
    if((await client.query('SELECT 1 FROM transactions WHERE id=$1',[id])).rowCount){await client.query('UPDATE users SET referral_reward_paid=1,updated_at=now() WHERE id=$1',[userId]);return;}
    const reward=10;
    const ref=await processWalletTransactionInClient(client,{userId:referrerId,type:'referral_reward',amount:reward,sourceId:id});
    if(!ref.success)throw new Error(ref.error||'Failed to issue referral reward');
    await client.query("INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,'referral_reward',$3,$4,$5,now())",[id,referrerId,reward,`Referral Reward — ${user.username||'a friend'} made their first deposit!`,id]);
    const own=await processWalletTransactionInClient(client,{userId,type:'referral_signup_bonus',amount:reward,sourceId:referredId});
    if(!own.success)throw new Error(own.error||'Failed to issue referral signup bonus');
    await client.query("INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,'referral_signup_bonus',$3,$4,$5,now())",[referredId,userId,reward,"Referral Signup Bonus — $10 for using a friend's referral code!",referredId]);
    await client.query('UPDATE users SET referral_reward_paid=1,updated_at=now() WHERE id=$1',[userId]);
    return {success:true,reward};
  });}catch(e){console.error('[Referral]',e);return {success:false};}
}
