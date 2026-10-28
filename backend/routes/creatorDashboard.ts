import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { writeLog } from './logs';

const app = new Hono();

// Ensure tables exist on startup
query(`
  CREATE TABLE IF NOT EXISTS creator_payout_requests (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    payment_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    admin_notes TEXT
  )
`).catch(e => console.error('[creator] payout table init failed:', e));

query(`
  CREATE TABLE IF NOT EXISTS creator_daily_allowance (
    creator_id TEXT PRIMARY KEY,
    amount_used NUMERIC(10,2) NOT NULL DEFAULT 0,
    pst_date TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.error('[creator] allowance table init failed:', e));

query(`
  CREATE TABLE IF NOT EXISTS creator_pending_deposits (
    payment_intent_id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
  )
`).catch(e => console.error('[creator] pending deposits table init failed:', e));

const DAILY_LIMIT = 100;

function getPSTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// Check if it's a new PST day; if so wipe wallet balance and reset counter.
// Returns current amount_used for today.
async function checkAndResetAllowance(creatorId: string): Promise<number> {
  const today = getPSTDate();
  const rows = await query<any>(
    'SELECT amount_used, pst_date FROM creator_daily_allowance WHERE creator_id=$1 LIMIT 1',
    [creatorId]
  );

  if (!rows[0] || rows[0].pst_date !== today) {
    // New day — wipe wallet balance and reset counter
    await query('UPDATE users SET balance=0 WHERE id=$1', [creatorId]);
    await query(`
      INSERT INTO creator_daily_allowance(creator_id, amount_used, pst_date, updated_at)
      VALUES($1, 0, $2, NOW())
      ON CONFLICT(creator_id) DO UPDATE SET amount_used=0, pst_date=$2, updated_at=NOW()
    `, [creatorId, today]);
    return 0;
  }

  return Number(rows[0].amount_used);
}

function getCreatorPayout(depositAmount: number): number {
  if (depositAmount >= 100) return 10;
  if (depositAmount >= 66) return 8;
  if (depositAmount >= 55) return 7;
  if (depositAmount >= 40) return 6;
  if (depositAmount >= 25) return 5;
  if (depositAmount >= 15) return 3;
  if (depositAmount >= 9) return 2;
  if (depositAmount >= 5) return 1;
  return 0;
}

async function getCreatorStats(userId: string) {
  const referredRows = await query<any>(
    'SELECT id, username, display_name, created_at, referral_reward_paid FROM users WHERE referred_by_id=$1 ORDER BY created_at DESC',
    [userId]
  );

  const referrals = await Promise.all(referredRows.map(async (ref: any) => {
    const firstDepRows = await query<any>(
      `SELECT amount FROM transactions WHERE user_id=$1 AND type='deposit' ORDER BY created_at ASC LIMIT 1`,
      [ref.id]
    );
    const firstDepositAmount = firstDepRows[0] ? Number(firstDepRows[0].amount) : null;
    const hasDeposited = firstDepositAmount !== null;
    const qualifies = firstDepositAmount !== null && firstDepositAmount >= 5;
    const payoutEarned = qualifies ? getCreatorPayout(firstDepositAmount!) : 0;

    // Check for a pending deposit (PI created but not yet confirmed)
    let pendingAmount: number | null = null;
    let depositStatus: 'confirmed' | 'pending' | 'none' = 'none';
    if (hasDeposited) {
      depositStatus = 'confirmed';
    } else {
      const pendingRow = await query<any>(
        `SELECT amount FROM creator_pending_deposits WHERE creator_id=$1 AND referred_user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1`,
        [userId, ref.id]
      );
      if (pendingRow[0]) {
        pendingAmount = Number(pendingRow[0].amount);
        depositStatus = 'pending';
      }
    }

    const effectiveAmount = firstDepositAmount ?? pendingAmount;
    const pendingPayout = depositStatus === 'pending' && pendingAmount !== null && pendingAmount >= 5
      ? getCreatorPayout(pendingAmount) : 0;

    return {
      id: ref.id,
      username: ref.username || ref.display_name || `User${ref.id.slice(-4)}`,
      signedUpAt: ref.created_at || '',
      firstDepositAmount: hasDeposited ? firstDepositAmount : null,
      pendingDepositAmount: depositStatus === 'pending' ? pendingAmount : null,
      depositStatus,
      hasDeposited,
      payoutEarned,
      pendingPayout,
      rewardPaid: Number(ref.referral_reward_paid || 0) > 0,
    };
  }));

  // XP: confirmed deposits count fully; pending deposits show as pending XP
  const xp = referrals.reduce((sum, r) =>
    r.firstDepositAmount !== null && r.firstDepositAmount >= 5 ? sum + r.firstDepositAmount : sum, 0);
  const pendingXp = referrals.reduce((sum, r) =>
    r.depositStatus === 'pending' && r.pendingDepositAmount !== null && r.pendingDepositAmount >= 5
      ? sum + r.pendingDepositAmount : sum, 0);
  const totalEarned = referrals.reduce((sum, r) => sum + r.payoutEarned, 0);
  const pendingEarned = referrals.reduce((sum, r) => sum + r.pendingPayout, 0);

  const paidOutRows = await query<any>(
    `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM creator_payout_requests WHERE creator_id=$1 AND status IN ('approved','paid')`,
    [userId]
  );
  const totalPaidOut = Number(paidOutRows[0]?.total || 0);

  const pendingRows = await query<any>(
    `SELECT id FROM creator_payout_requests WHERE creator_id=$1 AND status='pending' LIMIT 1`,
    [userId]
  );

  const availableForPayout = Math.max(0, totalEarned - totalPaidOut);
  return { referrals, xp, pendingXp, totalEarned, pendingEarned, totalPaidOut, availableForPayout, hasPendingRequest: pendingRows.length > 0 };
}

// Called from stripe.ts when a payment intent is created for a referred user
export async function recordPendingDeposit(paymentIntentId: string, creatorId: string, referredUserId: string, amount: number): Promise<void> {
  // Only record if this referred user hasn't already deposited
  const existing = await query<any>(
    `SELECT 1 FROM transactions WHERE user_id=$1 AND type='deposit' LIMIT 1`,
    [referredUserId]
  );
  if (existing[0]) return; // already has a confirmed deposit, skip
  await query(`
    INSERT INTO creator_pending_deposits(payment_intent_id, creator_id, referred_user_id, amount, status, created_at)
    VALUES($1,$2,$3,$4,'pending',NOW())
    ON CONFLICT(payment_intent_id) DO NOTHING
  `, [paymentIntentId, creatorId, referredUserId, amount]);
}

// Called from stripe.ts when payment_intent.succeeded fires
export async function confirmPendingDeposit(paymentIntentId: string): Promise<void> {
  await query(`
    UPDATE creator_pending_deposits SET status='confirmed', confirmed_at=NOW() WHERE payment_intent_id=$1
  `, [paymentIntentId]);
}

app.get('/creator/dashboard', async c => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 403); }
  try {
    const userRows = await query<any>('SELECT role, referral_code, username FROM users WHERE id=$1 LIMIT 1', [userId]);
    const user = userRows[0];
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (!['creator', 'admin', 'owner'].includes(user.role)) return c.json({ error: 'Creator access required' }, 403);

    const referralCode = user.referral_code || '';
    const stats = await getCreatorStats(userId);

    return c.json({
      referralCode,
      level: 1,
      xp: stats.xp,
      pendingXp: stats.pendingXp,
      xpToNextLevel: 500,
      totalEarned: stats.totalEarned,
      pendingEarned: stats.pendingEarned,
      totalPaidOut: stats.totalPaidOut,
      availableForPayout: stats.availableForPayout,
      canRequestPayout: stats.availableForPayout >= 25 && !stats.hasPendingRequest,
      hasPendingRequest: stats.hasPendingRequest,
      referrals: stats.referrals,
    });
  } catch (err: any) {
    console.error('[creator/dashboard]', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

app.post('/creator/request-payout', async c => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 403); }
  try {
    const body = await c.req.json().catch(() => ({}));
    const { paymentMethod, paymentDetails } = body;
    if (!paymentMethod || !paymentDetails) return c.json({ error: 'Payment method and details required' }, 400);

    const userRows = await query<any>('SELECT role, username FROM users WHERE id=$1 LIMIT 1', [userId]);
    const user = userRows[0];
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (!['creator', 'admin', 'owner'].includes(user.role)) return c.json({ error: 'Creator access required' }, 403);

    const stats = await getCreatorStats(userId);
    if (stats.hasPendingRequest) return c.json({ error: 'You already have a pending payout request' }, 400);
    if (stats.availableForPayout < 25) {
      return c.json({ error: `Minimum $25 required. You have $${stats.availableForPayout.toFixed(2)} available.` }, 400);
    }

    const id = `cpayout_${Date.now()}_${userId.slice(-8)}`;
    await query(
      `INSERT INTO creator_payout_requests(id,creator_id,amount,status,payment_method,payment_details,created_at) VALUES($1,$2,$3,'pending',$4,$5,NOW())`,
      [id, userId, stats.availableForPayout, paymentMethod, paymentDetails]
    );
    try {
      await writeLog(null, {
        type: 'creator_payout', userId, username: user.username || 'Creator',
        action: 'Creator Payout Requested',
        details: { requestId: id, amount: stats.availableForPayout, paymentMethod },
        valueIn: 0, valueOut: stats.availableForPayout, result: 'pending',
      });
    } catch {}
    return c.json({ success: true, requestId: id, amount: stats.availableForPayout });
  } catch (err: any) {
    console.error('[creator/request-payout]', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// GET /creator/daily-allowance — returns today's used/remaining allowance
app.get('/creator/daily-allowance', async c => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 403); }
  try {
    const userRows = await query<any>('SELECT role FROM users WHERE id=$1 LIMIT 1', [userId]);
    const user = userRows[0];
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (!['creator', 'admin', 'owner'].includes(user.role)) return c.json({ error: 'Creator access required' }, 403);

    const used = await checkAndResetAllowance(userId);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    return c.json({ used, limit: DAILY_LIMIT, remaining, pstDate: getPSTDate() });
  } catch (err: any) {
    console.error('[creator/daily-allowance]', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /creator/daily-allowance/apply — apply amount to wallet
app.post('/creator/daily-allowance/apply', async c => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 403); }
  try {
    const userRows = await query<any>('SELECT role, username FROM users WHERE id=$1 LIMIT 1', [userId]);
    const user = userRows[0];
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (!['creator', 'admin', 'owner'].includes(user.role)) return c.json({ error: 'Creator access required' }, 403);

    const body = await c.req.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400);

    const used = await checkAndResetAllowance(userId);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    if (amount > remaining) {
      return c.json({ error: `Only $${remaining.toFixed(2)} remaining in your daily allowance.` }, 400);
    }

    const today = getPSTDate();
    // Add to wallet balance
    await query('UPDATE users SET balance = COALESCE(balance,0) + $1 WHERE id=$2', [amount, userId]);
    // Record usage
    await query(`
      INSERT INTO creator_daily_allowance(creator_id, amount_used, pst_date, updated_at)
      VALUES($1, $2, $3, NOW())
      ON CONFLICT(creator_id) DO UPDATE SET amount_used = creator_daily_allowance.amount_used + $2, updated_at=NOW()
    `, [userId, amount, today]);

    const newUsed = used + amount;
    try {
      await writeLog(null, {
        type: 'creator_daily_allowance', userId, username: user.username || 'Creator',
        action: 'Creator Daily Allowance Applied',
        details: { amount, usedToday: newUsed, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - newUsed), pstDate: today },
        valueIn: amount, valueOut: 0, result: 'success',
      });
    } catch {}
    return c.json({ success: true, used: newUsed, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - newUsed) });
  } catch (err: any) {
    console.error('[creator/daily-allowance/apply]', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// Admin: list creator payout requests
app.get('/admin/creator-payouts', async c => {
  try {
    const rows = await query<any>(`
      SELECT cpr.*, u.username, u.email
      FROM creator_payout_requests cpr
      LEFT JOIN users u ON u.id = cpr.creator_id
      ORDER BY
        CASE cpr.status WHEN 'pending' THEN 0 ELSE 1 END,
        cpr.created_at DESC
      LIMIT 200
    `);
    return c.json({ requests: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin: update payout request status
app.post('/admin/creator-payouts/:id/status', async c => {
  try {
    const requestId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { status, adminNotes } = body;
    if (!['approved', 'paid', 'rejected'].includes(status)) return c.json({ error: 'Invalid status' }, 400);
    await query(
      `UPDATE creator_payout_requests SET status=$1, admin_notes=$2, processed_at=NOW() WHERE id=$3`,
      [status, adminNotes || null, requestId]
    );
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
