import { uid } from '../lib/auth';
import { transaction } from '../lib/postgres';

export interface WalletTransaction { userId:string; type:string; amount:number; sourceId?:string; metadata?:Record<string,unknown>; matchedAmount?:number; }
export interface WalletResult { success:boolean; error?:string; balanceBefore:number; balanceAfter:number; matchedBefore:number; matchedAfter:number; }

export async function processWalletTransaction(txn:WalletTransaction):Promise<WalletResult>{
  const ledgerId=`wt_${txn.type}_${txn.userId}_${txn.sourceId||uid()}`;
  try{return await transaction(async client=>{
    const existing=await client.query('SELECT balance_before,balance_after,matched_before,matched_after FROM wallet_transactions WHERE id=$1',[ledgerId]);
    if(existing.rowCount){const r=existing.rows[0];return{success:true,balanceBefore:Number(r.balance_before),balanceAfter:Number(r.balance_after),matchedBefore:Number(r.matched_before),matchedAfter:Number(r.matched_after)};}
    const user=await client.query('SELECT balance,matched_balance FROM users WHERE id=$1 FOR UPDATE',[txn.userId]);
    if(!user.rowCount)return{success:false,error:'User not found',balanceBefore:0,balanceAfter:0,matchedBefore:0,matchedAfter:0};
    const balanceBefore=Number(user.rows[0].balance||0),matchedBefore=Number(user.rows[0].matched_balance||0);let balanceAfter=balanceBefore,matchedAfter=matchedBefore;
    if(txn.amount>=0){balanceAfter+=txn.amount;if((txn.matchedAmount||0)>0)matchedAfter+=Number(txn.matchedAmount);}
    else{const debit=Math.abs(txn.amount);if(balanceBefore+matchedBefore<debit)return{success:false,error:'Insufficient balance',balanceBefore,balanceAfter:balanceBefore,matchedBefore,matchedAfter:matchedBefore};const matchedDebit=Math.min(matchedBefore,debit);const realDebit=debit-matchedDebit;balanceAfter=balanceBefore-realDebit;matchedAfter=matchedBefore-matchedDebit;}
    await client.query('UPDATE users SET balance=$1,matched_balance=$2,updated_at=now() WHERE id=$3',[balanceAfter,matchedAfter,txn.userId]);
    await client.query(`INSERT INTO wallet_transactions(id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING`,[ledgerId,txn.userId,txn.type,txn.amount,balanceBefore,balanceAfter,matchedBefore,matchedAfter,txn.sourceId||null,JSON.stringify(txn.metadata||{})]);
    return{success:true,balanceBefore,balanceAfter,matchedBefore,matchedAfter};
  });}catch(e:any){return{success:false,error:e?.message||'Wallet transaction failed',balanceBefore:0,balanceAfter:0,matchedBefore:0,matchedAfter:0};}
}
