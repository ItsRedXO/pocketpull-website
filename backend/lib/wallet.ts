/**
 * Centralized wallet transaction system.
 *
 * processWalletTransaction is the SINGLE authoritative function for ALL
 * balance changes. Every route that modifies a user's balance MUST call
 * this function instead of writing to blink.db.users directly.
 */
import { uid } from './auth';

export interface WalletTransaction {
  userId: string;
  type: string;          // 'sell' | 'sell_all' | 'pack_open' | 'upgrade' | 'battle_entry' | 'battle_cancel' | 'battle_join' | 'battle_entry_refund' | 'exchange_refund' | 'deposit' | 'referral_reward' | 'referral_signup_bonus' | 'first_deposit_bonus' | 'admin_credit' | 'admin_debit'
  amount: number;        // positive = credit, negative = debit
  sourceId?: string;     // inventoryId, battleId, paymentIntentId, chargeId, etc.
  metadata?: Record<string, any>;
  matchedAmount?: number; // if set on debit: deducted from matched_balance first; if set on credit: added to BOTH balance AND matched_balance
}

export interface WalletResult {
  success: boolean;
  error?: string;
  balanceBefore: number;
  balanceAfter: number;
  matchedBefore: number;
  matchedAfter: number;
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
  metadata: string;
  createdAt: string;
}

/**
 * The single authoritative function for ALL wallet balance changes.
 *
 * Handles:
 *  - Balance arithmetic (real + matched)
 *  - Matched-balance depletion (spend matched first on debits)
 *  - Matched-balance crediting (for first-deposit bonuses)
 *  - Idempotency via ledger ID
 *  - Ledger recording to wallet_transactions table
 *  - Realtime broadcast to `user-updates-{userId}`
 *  - DB persistence
 */
export async function processWalletTransaction(
  blink: any,
  txn: WalletTransaction,
): Promise<WalletResult> {
  try {
    // ── Idempotency: generate unique ledger ID (scoped to user) ──────────
    const ledgerId = `wt_${txn.type}_${txn.userId}_${txn.sourceId || uid()}`;

    try {
      const existing = await blink.db.table<WalletLedgerRow>('walletTransactions').get(ledgerId);
      if (existing) {
        console.log(`[Wallet] Ledger ${ledgerId} already exists — idempotent return.`);
        return {
          success: true,
          balanceBefore: Number(existing.balanceBefore),
          balanceAfter: Number(existing.balanceAfter),
          matchedBefore: Number(existing.matchedBefore),
          matchedAfter: Number(existing.matchedAfter),
        };
      }
    } catch {
      // No existing ledger — proceed
    }

    // ── Read current state ──────────────────────────────────────────────
    const user = await blink.db.users.get(txn.userId);
    if (!user) {
      console.error(`[Wallet] User ${txn.userId} not found for txn type=${txn.type}`);
      return {
        success: false,
        error: 'User not found',
        balanceBefore: 0,
        balanceAfter: 0,
        matchedBefore: 0,
        matchedAfter: 0,
      };
    }

    const currentBalance = Number(user.balance || 0);
    const matchedBalance = Number(user.matchedBalance || user.matched_balance || 0);

    let newBalance: number;
    let newMatched: number;

    if (txn.amount >= 0) {
      // ── Credit ────────────────────────────────────────────────────────
      newBalance = currentBalance + txn.amount;

      if (txn.matchedAmount && txn.matchedAmount > 0) {
        // Credits can also add to matched balance (e.g. first_deposit_bonus).
        // Only add matched when the transaction itself is a real credit (amount > 0).
        // $0 transactions (free packs) should never alter matched balance.
        if (txn.amount > 0) {
          newMatched = matchedBalance + txn.matchedAmount;
        } else {
          newMatched = matchedBalance;
        }
      } else {
        newMatched = matchedBalance;
      }
    } else {
      // ── Debit ─────────────────────────────────────────────────────────
      const absAmount = Math.abs(txn.amount);

      if (txn.matchedAmount && txn.matchedAmount > 0) {
        // fromMatched covers as much of the purchase as possible from
        // matched balance, capped at the purchase amount (can't spend
        // more matched than the item costs) and at available matched.
        const fromMatched = Math.min(matchedBalance, absAmount);
        const fromReal = absAmount - fromMatched;
        // Total balance drops by absAmount regardless of split source.
        newBalance = Math.max(0, currentBalance - absAmount);
        newMatched = Math.max(0, matchedBalance - fromMatched);
      } else {
        newBalance = Math.max(0, currentBalance - absAmount);
        newMatched = matchedBalance;
      }
    }

    // ── Write to DB ─────────────────────────────────────────────────────
    await blink.db.users.update(txn.userId, {
      balance: newBalance,
      matchedBalance: newMatched,
    });

    // ── Write ledger entry ──────────────────────────────────────────────
    await blink.db.table<WalletLedgerRow>('walletTransactions').create({
      id: ledgerId,
      userId: txn.userId,
      type: txn.type,
      amount: txn.amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      matchedBefore: matchedBalance,
      matchedAfter: newMatched,
      sourceId: txn.sourceId || null,
      metadata: JSON.stringify(txn.metadata || {}),
    });

    // ── Realtime broadcast ──────────────────────────────────────────────
    try {
      await blink.realtime.publish(`user-updates-${txn.userId}`, 'balance_updated', {
        newBalance,
        newMatchedBalance: newMatched,
      });
    } catch (realtimeErr: any) {
      console.warn(`[Wallet] Realtime publish failed for user ${txn.userId}:`, realtimeErr?.message);
    }

    console.log(
      `[Wallet] ✅ ${txn.type} | user=${txn.userId} | amt=${txn.amount.toFixed(2)} ` +
      `bal=${currentBalance.toFixed(2)}→${newBalance.toFixed(2)} ` +
      `matched=${matchedBalance.toFixed(2)}→${newMatched.toFixed(2)} ` +
      `ledger=${ledgerId}`,
    );

    return {
      success: true,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      matchedBefore: matchedBalance,
      matchedAfter: newMatched,
    };
  } catch (err: any) {
    console.error(`[Wallet] ❌ Fatal error processing ${txn.type} for user ${txn.userId}:`, err.message);
    return {
      success: false,
      error: err.message || 'Internal wallet transaction error',
      balanceBefore: 0,
      balanceAfter: 0,
      matchedBefore: 0,
      matchedAfter: 0,
    };
  }
}
