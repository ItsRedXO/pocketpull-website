/**
 * Centralized wallet transaction system.
 *
 * PostgreSQL is now the authoritative store for balances and the wallet ledger.
 * Every balance mutation must pass through processWalletTransaction so the
 * balance update and ledger row commit atomically under a row lock.
 */
import { uid } from './auth';

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

export interface WalletBalanceCalculation {
  balanceAfter: number;
  matchedAfter: number;
}

/**
 * Apply PocketPull's balance semantics without touching the database.
 * Matched funds are consumed first when matchedAmount is supplied. Only the
 * portion not covered by matched funds reduces the real balance.
 */
export function calculateWalletBalances(
  currentBalance: number,
  matchedBalance: number,
  amount: number,
  spendMatchedFirst: boolean,
  matchedAmount = 0,
): WalletBalanceCalculation {
  if (amount >= 0) {
    return {
      balanceAfter: currentBalance + amount,
      matchedAfter: amount > 0 && matchedAmount > 0 ? matchedBalance + matchedAmount : matchedBalance,
    };
  }

  const debit = Math.abs(amount);
  if (!spendMatchedFirst || matchedAmount <= 0) {
    return {
      balanceAfter: Math.max(0, currentBalance - debit),
      matchedAfter: matchedBalance,
    };
  }

  const fromMatched = Math.min(matchedBalance, debit);
  const fromReal = debit - fromMatched;
  return {
    balanceAfter: Math.max(0, currentBalance - fromReal),
    matchedAfter: Math.max(0, matchedBalance - fromMatched),
  };
}

interface WalletLedgerRow {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  matchedBefore: number;
  matchedAfter: number;
  sourceId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export async function processWalletTransaction(blink: any, txn: WalletTransaction): Promise<WalletResult> {
  const ledgerId = `wt_${txn.type}_${txn.userId}_${txn.sourceId || uid()}`;

  try {
    const result = await blink.db.transaction(async (client: any) => {
      // The ledger id is deterministic for idempotent operations. Check it
      // inside the same transaction as the balance lock.
      const existing = await client.query(
        'SELECT id, balance_before, balance_after, matched_before, matched_after FROM wallet_transactions WHERE id = $1 LIMIT 1',
        [ledgerId],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        return {
          success: true,
          balanceBefore: Number(row.balance_before),
          balanceAfter: Number(row.balance_after),
          matchedBefore: Number(row.matched_before),
          matchedAfter: Number(row.matched_after),
        } as WalletResult;
      }

      // Serialize all balance mutations for this user.
      const userResult = await client.query(
        'SELECT id, balance, matched_balance, is_deleted, is_banned FROM users WHERE id = $1 FOR UPDATE',
        [txn.userId],
      );
      const user = userResult.rows[0];
      if (!user) {
        return { success: false, error: 'User not found', balanceBefore: 0, balanceAfter: 0, matchedBefore: 0, matchedAfter: 0 } as WalletResult;
      }

      const currentBalance = Number(user.balance || 0);
      const matchedBalance = Number(user.matched_balance || 0);
      const balances = calculateWalletBalances(
        currentBalance,
        matchedBalance,
        txn.amount,
        Boolean(txn.matchedAmount && txn.matchedAmount > 0),
        Number(txn.matchedAmount || 0),
      );

      await client.query(
        'UPDATE users SET balance = $1, matched_balance = $2, updated_at = NOW() WHERE id = $3',
        [balances.balanceAfter, balances.matchedAfter, txn.userId],
      );

      await client.query(
        `INSERT INTO wallet_transactions
          (id, user_id, type, amount, balance_before, balance_after, matched_before, matched_after, source_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          ledgerId,
          txn.userId,
          txn.type,
          txn.amount,
          currentBalance,
          balances.balanceAfter,
          matchedBalance,
          balances.matchedAfter,
          txn.sourceId || null,
          JSON.stringify(txn.metadata || {}),
        ],
      );

      return {
        success: true,
        balanceBefore: currentBalance,
        balanceAfter: balances.balanceAfter,
        matchedBefore: matchedBalance,
        matchedAfter: balances.matchedAfter,
      } as WalletResult;
    });

    if (result.success) {
      console.log(
        `[Wallet] OK ${txn.type} | user=${txn.userId} | amt=${txn.amount.toFixed(2)} ` +
        `bal=${result.balanceBefore.toFixed(2)}→${result.balanceAfter.toFixed(2)} ` +
        `matched=${result.matchedBefore.toFixed(2)}→${result.matchedAfter.toFixed(2)} | ledger=${ledgerId}`,
      );
    }

    return result;
  } catch (err: any) {
    // Concurrent duplicate delivery of the same idempotency key can race at
    // the unique ledger constraint. The first committed transaction wins;
    // return its result rather than treating the duplicate as a failed charge.
    if (err?.code === '23505') {
      try {
        const existing = await blink.db.table<WalletLedgerRow>('walletTransactions').get(ledgerId);
        if (existing) {
          return {
            success: true,
            balanceBefore: Number(existing.balanceBefore),
            balanceAfter: Number(existing.balanceAfter),
            matchedBefore: Number(existing.matchedBefore),
            matchedAfter: Number(existing.matchedAfter),
          };
        }
      } catch {
        // Fall through to the normal error response.
      }
    }

    console.error(`[Wallet] Fatal error processing ${txn.type} for ${txn.userId}:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Internal wallet transaction error',
      balanceBefore: 0,
      balanceAfter: 0,
      matchedBefore: 0,
      matchedAfter: 0,
    };
  }
}
