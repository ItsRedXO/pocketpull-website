import type { PoolClient } from 'pg';
import { getDb, type DbEnv } from '../client';

export interface AtomicWalletTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  matchedAmount?: number;
}

export interface AtomicWalletResult {
  success: boolean;
  error?: string;
  balanceBefore: number;
  balanceAfter: number;
  matchedBefore: number;
  matchedAfter: number;
}

export function calculateWalletBalances(
  balanceBefore: number,
  matchedBefore: number,
  amount: number,
  matchedAmount = 0,
): { balanceAfter: number; matchedAfter: number } {
  if (amount > 0) {
    return {
      balanceAfter: balanceBefore + amount,
      matchedAfter: matchedBefore + (matchedAmount > 0 ? matchedAmount : 0),
    };
  }

  if (amount === 0) {
    return { balanceAfter: balanceBefore, matchedAfter: matchedBefore };
  }

  const debit = Math.abs(amount);
  const useMatched = matchedAmount > 0;
  const matchedSpent = useMatched ? Math.min(matchedBefore, debit) : 0;

  return {
    balanceAfter: Math.max(0, balanceBefore - debit),
    matchedAfter: Math.max(0, matchedBefore - matchedSpent),
  };
}

async function findExistingLedger(client: PoolClient, id: string): Promise<AtomicWalletResult | null> {
  const existing = await client.query<{
    balance_before: string;
    balance_after: string;
    matched_before: string;
    matched_after: string;
  }>(
    `SELECT balance_before, balance_after, matched_before, matched_after
       FROM wallet_transactions
      WHERE id = $1
      LIMIT 1`,
    [id],
  );

  const row = existing.rows[0];
  if (!row) return null;

  return {
    success: true,
    balanceBefore: Number(row.balance_before),
    balanceAfter: Number(row.balance_after),
    matchedBefore: Number(row.matched_before),
    matchedAfter: Number(row.matched_after),
  };
}

export async function processAtomicWalletTransaction(
  env: DbEnv,
  txn: AtomicWalletTransaction,
): Promise<AtomicWalletResult> {
  const client = await getDb(env).connect();

  try {
    await client.query('BEGIN');

    const existing = await findExistingLedger(client, txn.id);
    if (existing) {
      await client.query('COMMIT');
      return existing;
    }

    const userResult = await client.query<{
      balance: string;
      matched_balance: string;
    }>(
      `SELECT balance, matched_balance
         FROM users
        WHERE id = $1
        FOR UPDATE`,
      [txn.userId],
    );

    const user = userResult.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'User not found',
        balanceBefore: 0,
        balanceAfter: 0,
        matchedBefore: 0,
        matchedAfter: 0,
      };
    }

    const balanceBefore = Number(user.balance || 0);
    const matchedBefore = Number(user.matched_balance || 0);
    const spendable = balanceBefore + matchedBefore;

    if (txn.amount < 0 && spendable < Math.abs(txn.amount)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Insufficient balance',
        balanceBefore,
        balanceAfter: balanceBefore,
        matchedBefore,
        matchedAfter: matchedBefore,
      };
    }

    const { balanceAfter, matchedAfter } = calculateWalletBalances(
      balanceBefore,
      matchedBefore,
      txn.amount,
      txn.matchedAmount || 0,
    );

    await client.query(
      `UPDATE users
          SET balance = $2,
              matched_balance = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [txn.userId, balanceAfter, matchedAfter],
    );

    await client.query(
      `INSERT INTO wallet_transactions (
         id, user_id, type, amount,
         balance_before, balance_after,
         matched_before, matched_after,
         source_id, metadata, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW())`,
      [
        txn.id,
        txn.userId,
        txn.type,
        txn.amount,
        balanceBefore,
        balanceAfter,
        matchedBefore,
        matchedAfter,
        txn.sourceId || null,
        JSON.stringify(txn.metadata || {}),
      ],
    );

    await client.query('COMMIT');

    return {
      success: true,
      balanceBefore,
      balanceAfter,
      matchedBefore,
      matchedAfter,
    };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failure; preserve original error.
    }

    return {
      success: false,
      error: err?.message || 'Internal wallet transaction error',
      balanceBefore: 0,
      balanceAfter: 0,
      matchedBefore: 0,
      matchedAfter: 0,
    };
  } finally {
    client.release();
  }
}
