import { uid } from './auth';
import { processAtomicWalletTransaction } from '../db/repositories/wallet';

export interface WalletTransaction {
  userId: string;
  type: string;
  amount: number;
  sourceId?: string;
  metadata?: Record<string, any>;
  matchedAmount?: number;
}

export interface WalletResult {
  success: boolean;
  error?: string;
  balanceBefore: number;
  balanceAfter: number;
  matchedBefore: number;
  matchedAfter: number;
}

export async function processWalletTransaction(blink: any, txn: WalletTransaction): Promise<WalletResult> {
  const env = blink?.__pocketpullEnv;
  if (!env) return { success: false, error: 'PostgreSQL runtime environment unavailable', balanceBefore: 0, balanceAfter: 0, matchedBefore: 0, matchedAfter: 0 };
  const ledgerId = `wt_${txn.type}_${txn.userId}_${txn.sourceId || uid()}`;
  return processAtomicWalletTransaction(env, {
    id: ledgerId,
    userId: txn.userId,
    type: txn.type,
    amount: txn.amount,
    sourceId: txn.sourceId || null,
    metadata: txn.metadata,
    matchedAmount: txn.matchedAmount || 0,
  });
}
