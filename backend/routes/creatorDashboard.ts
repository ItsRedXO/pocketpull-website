import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();

// Ensure table exists on startup
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
`).catch(e => console.error('[creator] table init failed:', e));

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
    return {
      id: ref.id,
      username: ref.username || ref.display_name || `User${ref.id.slice(-4)}`,
      signedUpAt: ref.created_at || '',
      firstDepositAmount: hasDeposited ? firstDepositAmount : null,
      hasDeposited,
      payoutEarned,
      rewardPaid: Number(ref.referral_reward_paid || 0) > 0,
    };
  }));

  const xp = referrals.reduce((sum, r) =>
    r.firstDepositAmount !== null && r.firstDepositAmount >= 5 ? sum + r.firstDepositAmount : sum, 0);
  const totalEarned = referrals.reduce((sum, r) => sum + r.payoutEarned, 0);

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
  return { referrals, xp, totalEarned, totalPaidOut, availableForPayout, hasPendingRequest: pendingRows.length > 0 };
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
      xpToNextLevel: 500,
      totalEarned: stats.totalEarned,
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
    return c.json({ success: true, requestId: id, amount: stats.availableForPayout });
  } catch (err: any) {
    console.error('[creator/request-payout]', err);
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
