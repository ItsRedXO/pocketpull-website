import { getDb } from '../db/client';
import { getUserProfile } from '../db/repositories/users';
import { writeLog } from '../routes/logs';
import { processWalletTransaction } from './wallet';

async function recordTransaction(env: any, id: string, userId: string, type: string, amount: number, description: string) {
  await getDb(env).query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (id) DO NOTHING`, [id, userId, type, amount, description]);
}

export async function processFirstDepositBonus(blink: any, userId: string, depositAmt: number) {
  const env = blink?.__pocketpullEnv;
  if (!env || depositAmt <= 0) return;
  try {
    const user = await getUserProfile(env, userId);
    if (!user || user.firstDepositBonusPaid) return;
    const bonus = Math.min(depositAmt, 100);
    const txnId = `txn_first_deposit_bonus_${userId}`;
    const wallet = await processWalletTransaction(blink, { userId, type: 'first_deposit_bonus', amount: bonus, matchedAmount: bonus, sourceId: txnId });
    if (!wallet.success) return;
    await recordTransaction(env, txnId, userId, 'first_deposit_bonus', bonus, `First Deposit Bonus — 100% match (deposited ${depositAmt.toFixed(2)}, earned ${bonus.toFixed(2)})`);
    await getDb(env).query('UPDATE users SET first_deposit_bonus_paid=TRUE,updated_at=NOW() WHERE id=$1', [userId]);
    await writeLog(blink, { type: 'bonus', userId, username: user.username || user.displayName || 'Trainer', action: 'First Deposit Bonus Paid', details: { depositAmt, bonus, capped: depositAmt > 100 }, valueIn: bonus, valueOut: 0, result: 'success' });
  } catch (err: any) { console.error('[FirstDeposit] Error:', err?.message || err); }
}

export async function processReferralReward(blink: any, userId: string, referrerId: string, depositAmt: number) {
  const env = blink?.__pocketpullEnv;
  if (!env || depositAmt < 5 || !referrerId || referrerId === userId) return;
  try {
    const user = await getUserProfile(env, userId);
    const referrer = await getUserProfile(env, referrerId);
    if (!user || !referrer || user.referralRewardPaid) return;
    const reward = 10;
    const refTxn = `txn_referral_reward_${userId}_v3`;
    const referredTxn = `txn_referral_referred_bonus_${userId}_v1`;
    const referrerWallet = await processWalletTransaction(blink, { userId: referrerId, type: 'referral_reward', amount: reward, sourceId: refTxn });
    if (!referrerWallet.success) return;
    const referredWallet = await processWalletTransaction(blink, { userId, type: 'referral_signup_bonus', amount: reward, sourceId: referredTxn });
    if (!referredWallet.success) return;
    await recordTransaction(env, refTxn, referrerId, 'referral_reward', reward, `Referral Reward — ${user.username || 'a friend'} made their first deposit!`);
    await recordTransaction(env, referredTxn, userId, 'referral_signup_bonus', reward, `Referral Signup Bonus — $10 for using a friend's referral code!`);
    await getDb(env).query('UPDATE users SET referral_reward_paid=TRUE,updated_at=NOW() WHERE id=$1', [userId]);
    await writeLog(blink, { type: 'referral', userId: referrerId, username: referrer.username || 'Trainer', action: 'Referral Reward Paid ($10)', details: { referredUserId: userId, referredUsername: user.username || 'Trainer', depositAmt, reward }, valueIn: reward, valueOut: 0, result: 'success' });
    await writeLog(blink, { type: 'referral', userId, username: user.username || 'Trainer', action: 'Referral Signup Bonus Paid ($10)', details: { referrerId, depositAmt, reward }, valueIn: reward, valueOut: 0, result: 'success' });
  } catch (err: any) { console.error('[Referral] Error:', err?.message || err); }
}
