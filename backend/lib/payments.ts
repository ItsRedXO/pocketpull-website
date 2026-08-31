/**
 * Shared payment helpers used by both Stripe and Coinbase routes.
 */
import { writeLog } from '../routes/logs';
import { processWalletTransaction } from './wallet';

/**
 * Award a 100% first-deposit match bonus up to $100.
 * Each user can claim this exactly once, on their first-ever deposit.
 */
export async function processFirstDepositBonus(
  blink: any,
  userId: string,
  depositAmt: number,
) {
  try {
    // Guard: only first deposit qualifies
    const user = await blink.db.users.get(userId) as any;
    if (!user) {
      console.log(`[FirstDeposit] User ${userId} not found. Skipping.`);
      return;
    }
    if (user.firstDepositBonusPaid || Number(user.firstDepositBonusPaid) > 0) {
      console.log(`[FirstDeposit] User ${userId} already received bonus. Skipping.`);
      return;
    }

    // Idempotency via unique transaction ID
    const bonusTxnId = `txn_first_deposit_bonus_${userId}`;
    try {
      const existing = await blink.db.transactions.get(bonusTxnId);
      if (existing) {
        console.log(`[FirstDeposit] Bonus transaction ${bonusTxnId} exists. Marking as paid.`);
        await blink.db.users.update(userId, { firstDepositBonusPaid: 1 });
        return;
      }
    } catch {}

    // 100% match, capped at $100
    const bonus = Math.min(depositAmt, 100);
    if (bonus <= 0) {
      console.log(`[FirstDeposit] Bonus amount is $0. Skipping.`);
      return;
    }

    // Mark bonus as paid BEFORE wallet call (wallet is idempotent)
    await blink.db.users.update(userId, { firstDepositBonusPaid: 1 });

    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'first_deposit_bonus',
      amount: bonus,
      matchedAmount: bonus, // adds to BOTH balance and matchedBalance
      sourceId: bonusTxnId,
    });

    if (!walletResult.success) {
      console.error(`[FirstDeposit] Wallet transaction failed: ${walletResult.error}`);
      return;
    }

    const newBal = walletResult.balanceAfter;

    await blink.db.transactions.create({
      id: bonusTxnId,
      userId,
      type: 'first_deposit_bonus',
      amount: bonus,
      description: `First Deposit Bonus — 100% match (Matched funds) (Deposited ${depositAmt.toFixed(2)}, earned ${bonus.toFixed(2)})`,
      createdAt: new Date().toISOString(),
    } as any);

    console.log(`[FirstDeposit] Paid ${bonus} bonus to user ${userId}. New balance: ${newBal}`);

    // Activity log
    try {
      await writeLog(blink, {
        type: 'bonus',
        userId,
        username: user.username || user.displayName || 'Trainer',
        action: 'First Deposit Bonus Paid',
        details: { depositAmt, bonus, capped: depositAmt > 100 },
        valueIn: bonus,
        valueOut: 0,
        result: 'success',
      });
    } catch {}
  } catch (err: any) {
    console.error('[FirstDeposit] Error:', err.message);
  }
}

/**
 * Award $10 referral rewards to BOTH the referrer and the referred user
 * when the referred user completes their first successful deposit of $5+.
 *
 * Referrer earns $10 per unique referred user, only once per referred account.
 * Referred user also receives a flat $10 bonus (separate from the first-deposit match).
 */
export async function processReferralReward(
  blink: any,
  userId: string,
  referrerId: string,
  depositAmt: number,
) {
  console.log(`[Referral] Processing $10 rewards. User: ${userId}, Referrer: ${referrerId}`);

  try {
    // Check the referred user — has this referral already been paid?
    const user = await blink.db.users.get(userId) as any;
    if (!user) {
      console.error(`[Referral] Referred user ${userId} not found.`);
      return;
    }
    if (user.referralRewardPaid || Number(user.referralRewardPaid) > 0) {
      console.log(`[Referral] Reward for referral ${userId} already paid. Skipping.`);
      return;
    }

    // Check referrer exists
    const referrer = await blink.db.users.get(referrerId) as any;
    if (!referrer) {
      console.error(`[Referral] Referrer ${referrerId} not found.`);
      return;
    }

    // Idempotency via unique transaction IDs
    const rewardTxnId = `txn_referral_reward_${userId}_v3`;
    const referredRewardTxnId = `txn_referral_referred_bonus_${userId}_v1`;
    try {
      const existing = await blink.db.transactions.get(rewardTxnId);
      if (existing) {
        console.log(`[Referral] Reward transaction ${rewardTxnId} exists. Marking as paid.`);
        await blink.db.users.update(userId, { referralRewardPaid: 1 });
        return;
      }
    } catch {}

    const reward = 10.00;

    // Mark referral as paid on the referred user (prevents double-paying)
    await blink.db.users.update(userId, { referralRewardPaid: 1 });

    // ═══ Credit $10 to the REFERRER ═══
    const referrerWallet = await processWalletTransaction(blink, {
      userId: referrerId,
      type: 'referral_reward',
      amount: reward,
      sourceId: rewardTxnId,
    });

    if (!referrerWallet.success) {
      console.error(`[Referral] Wallet transaction for referrer failed: ${referrerWallet.error}`);
      return;
    }

    const referrerBal = referrerWallet.balanceAfter;

    await blink.db.transactions.create({
      id: rewardTxnId,
      userId: referrerId,
      type: 'referral_reward',
      amount: reward,
      description: `Referral Reward — ${user.username || 'a friend'} made their first deposit!`,
      createdAt: new Date().toISOString(),
    } as any);

    console.log(`[Referral] ${reward} paid to referrer ${referrerId}. New balance: ${referrerBal}`);

    // Activity log for referrer
    try {
      await writeLog(blink, {
        type: 'referral',
        userId: referrerId,
        username: referrer.username || 'Trainer',
        action: 'Referral Reward Paid ($10)',
        details: {
          referredUserId: userId,
          referredUsername: user.username || 'Trainer',
          depositAmt,
          reward,
        },
        valueIn: reward,
        valueOut: 0,
        result: 'success',
      });
    } catch {}

    // ═══ Credit $10 to the REFERRED USER ═══
    const referredWallet = await processWalletTransaction(blink, {
      userId,
      type: 'referral_signup_bonus',
      amount: reward,
      sourceId: referredRewardTxnId,
    });

    if (!referredWallet.success) {
      console.error(`[Referral] Wallet transaction for referred user failed: ${referredWallet.error}`);
      return;
    }

    const referredBal = referredWallet.balanceAfter;

    await blink.db.transactions.create({
      id: referredRewardTxnId,
      userId,
      type: 'referral_signup_bonus',
      amount: reward,
      description: `Referral Signup Bonus — $10 for using a friend's referral code!`,
      createdAt: new Date().toISOString(),
    } as any);

    console.log(`[Referral] ${reward} paid to referred user ${userId}. New balance: ${referredBal}`);

    // Activity log for referred user
    try {
      await writeLog(blink, {
        type: 'referral',
        userId,
        username: user.username || 'Trainer',
        action: 'Referral Signup Bonus Received ($10)',
        details: {
          referrerId,
          referrerUsername: referrer.username || 'Trainer',
          depositAmt,
          reward,
        },
        valueIn: reward,
        valueOut: 0,
        result: 'success',
      });
    } catch {}

  } catch (err: any) {
    console.error('[Referral] Error:', err.message);
  }
}
