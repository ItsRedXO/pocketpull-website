import { transaction } from '../lib/postgres';

export interface WalletTransaction { userId: string; type: string; amount: number; sourceId?: string; metadata?: Record<string, unknown>; matchedAmount?: number; }
export interface WalletResult { success: boolean; error?: string; balanceBefore: number; balanceAfter: number; matchedBefore: number; matchedAfter: number; }

export async function processWalletTransaction(txn: WalletTransaction): Promise<WalletResult> {
  const ledgerId = `wt_${txn.type}_${txn.userId}_${txn.sourceId || crypto.randomUUID()}`;
  try {
    return await transaction(async client => {
      const existing = await client.query('SELECT balance_before,balance_after,matched_before,matched_after FROM wallet_transactions WHERE id=$1', [ledgerId]);
      if (existing.rowCount) {
        const r = existing.rows[0];
        return { success: true, balanceBefore: Number(r.balance_before), balanceAfter: Number(r.balance_after), matchedBefore: Number(r.matched_before), matchedAfter: Number(r.matched_after) };
      }
      const user = await client.query('SELECT balance,matched_balance FROM users WHERE id=$1 FOR UPDATE', [txn.userId]);
      if (!user.rowCount) return { success:false, error:'User not found', balanceBefore:0, balanceAfter:0, matchedBefore:0, matchedAfter:0 };
      const before = Number(user.rows[0].balance || 0), matched = Number(user.rows[0].matched_balance || 0);
      let after = before, matchedAfter = matched;
      if (txn.amount >= 0) { after += txn.amount; if ((txn.matchedAmount || 0) > 0 && txn.amount > 0) matchedAfter += txn.matchedAmount!; }
      else { const debit = Math.abs(txn.amount); if (before < debit) return {success:false,error:'Insufficient balance',balanceBefore:before,balanceAfter:before,matchedBefore:matched,matchedAfter:matched}; after -= debit; if ((txn.matchedAmount || 0) > 0) matchedAfter = Math.max(0, matched - Math.min(matched, debit)); }
      await client.query('UPDATE users SET balance=$1, matched_balance=$2, updated_at=now() WHERE id=$3', [after, matchedAfter, txn.userId]);
      await client.query('INSERT INTO wallet_transactions (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING', [ledgerId,txn.userId,txn.type,txn.amount,before,after,matched,matchedAfter,txn.sourceId || null,JSON.stringify(txn.metadata || {})]);
      return {success:true,balanceBefore:before,balanceAfter:after,matchedBefore:matched,matchedAfter};
    });
  } catch (e: any) { return {success:false,error:e.message || 'Wallet transaction failed',balanceBefore:0,balanceAfter:0,matchedBefore:0,matchedAfter:0}; }
}
