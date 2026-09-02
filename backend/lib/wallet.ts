import { processWalletTransaction as processPostgresWalletTransaction, type WalletTransaction, type WalletResult } from '../repositories/wallet';
export type { WalletTransaction, WalletResult };
/** Authoritative PostgreSQL wallet mutation. Kept as a compatibility wrapper for existing routes. */
export async function processWalletTransaction(_blink: unknown, txn: WalletTransaction): Promise<WalletResult> {
  return processPostgresWalletTransaction(txn);
}
