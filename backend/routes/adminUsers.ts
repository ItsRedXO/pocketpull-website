import { Hono } from 'hono';
import { query } from '../lib/postgres';
import { requireAuth, uid } from '../lib/auth';
import { processWalletTransaction } from '../repositories/wallet';
import { writeLog } from './logs';

const app = new Hono();

async function requireAdmin(c: any): Promise<string> {
  const secret = c.req.header('X-Admin-Secret');
  if (secret && secret !== 'true') {
    const rows = await query<{ id: string }>(
      'SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1',
      [secret],
    );
    if (rows[0]?.id) return rows[0].id;
  }

  const userId = await requireAuth(c);
  const rows = await query<{ role: string; is_admin: number }>(
    'SELECT role, is_admin FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) {
    throw new Error('FORBIDDEN');
  }
  return userId;
}

app.post('/admin/users/:id/balance', async (c) => {
  try {
    const adminUserId = await requireAdmin(c);
    const targetUserId = c.req.param('id');
    const body = await c.req.json<{ mode?: 'add' | 'set'; amount?: number }>();
    const mode = body.mode === 'set' ? 'set' : 'add';
    const amount = Number(body.amount);

    if (!targetUserId || !Number.isFinite(amount)) {
      return c.json({ success: false, error: 'Invalid balance amount.' }, 400);
    }
    if (mode === 'add' && amount === 0) {
      return c.json({ success: false, error: 'Balance adjustment cannot be zero.' }, 400);
    }
    if (mode === 'set' && amount < 0) {
      return c.json({ success: false, error: 'Balance cannot be negative.' }, 400);
    }

    const target = await query<{ id: string; balance: string; matched_balance: string; username: string }>(
      'SELECT id,balance,matched_balance,username FROM users WHERE id=$1 LIMIT 1',
      [targetUserId],
    );
    if (!target[0]) return c.json({ success: false, error: 'User not found.' }, 404);

    const before = Number(target[0].balance || 0);
    const delta = mode === 'set' ? amount - before : amount;
    if (delta === 0) {
      return c.json({ success: true, balance: before, previousBalance: before, delta: 0 });
    }

    const result = await processWalletTransaction({
      userId: targetUserId,
      type: delta >= 0 ? 'admin_credit' : 'admin_debit',
      amount: delta,
      sourceId: `admin_balance_${uid()}`,
      metadata: { adminUserId, mode, requestedAmount: amount },
      allowMatchedDebit: false,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error || 'Balance update failed.' }, 400);
    }

    await writeLog(null, {
      userId: targetUserId,
      type: 'admin_balance',
      username: target[0].username || 'Unknown',
      action: `Admin ${mode === 'set' ? 'Set' : 'Adjusted'} Balance`,
      details: { adminUserId, mode, delta, newBalance: result.balanceAfter, previousBalance: result.balanceBefore },
      valueIn: delta > 0 ? delta : 0,
      valueOut: delta < 0 ? Math.abs(delta) : 0,
      result: 'success',
    });

    return c.json({
      success: true,
      balance: result.balanceAfter,
      previousBalance: result.balanceBefore,
      delta,
    });
  } catch (error: any) {
    const message = error?.message || 'Balance update failed.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/admin/users/:id/gems', async (c) => {
  try {
    const adminUserId = await requireAdmin(c);
    const targetUserId = c.req.param('id');
    const body = await c.req.json<{ mode?: 'add' | 'set'; amount?: number }>();
    const mode = body.mode === 'set' ? 'set' : 'add';
    const amount = Number(body.amount);

    if (!targetUserId || !Number.isFinite(amount)) {
      return c.json({ success: false, error: 'Invalid gems amount.' }, 400);
    }
    if (mode === 'add' && amount === 0) {
      return c.json({ success: false, error: 'Gems adjustment cannot be zero.' }, 400);
    }
    if (mode === 'set' && amount < 0) {
      return c.json({ success: false, error: 'Gems cannot be negative.' }, 400);
    }

    const target = await query<{ id: string; gems: string; username: string }>(
      'SELECT id, COALESCE(gems, 0) AS gems, username FROM users WHERE id=$1 LIMIT 1',
      [targetUserId],
    );
    if (!target[0]) return c.json({ success: false, error: 'User not found.' }, 404);

    const before = Number(target[0].gems || 0);
    const newGems = mode === 'set' ? Math.max(0, amount) : Math.max(0, before + amount);
    const delta = newGems - before;

    if (delta === 0) {
      return c.json({ success: true, gems: before, previousGems: before, delta: 0 });
    }

    const rows = await query<{ gems: number }>(
      'UPDATE users SET gems = $1 WHERE id = $2 RETURNING gems',
      [newGems, targetUserId],
    );

    await query(
      `INSERT INTO gem_transactions(id, user_id, amount, balance_before, balance_after, source_type, source_id, metadata)
       VALUES($1, $2, $3, $4, $5, 'admin_adjustment', $6, $7)`,
      [uid(), targetUserId, delta, before, newGems, `admin:${adminUserId}`, JSON.stringify({ adminUserId, mode })],
    );

    await writeLog(null, {
      userId: targetUserId,
      type: 'admin_gems',
      username: target[0].username || 'Unknown',
      action: `Admin ${mode === 'set' ? 'Set' : 'Adjusted'} Gems`,
      details: { adminUserId, mode, delta, newGems, previousGems: before },
      valueIn: delta > 0 ? delta : 0,
      valueOut: delta < 0 ? Math.abs(delta) : 0,
      result: 'success',
    });

    return c.json({
      success: true,
      gems: rows[0]?.gems ?? newGems,
      previousGems: before,
      delta,
    });
  } catch (error: any) {
    const message = error?.message || 'Gems update failed.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.get('/admin/users/card-values', async (c) => {
  try {
    await requireAdmin(c);
    const rows = await query<{ user_id: string; total_value: string }>(
      `SELECT user_id, COALESCE(SUM(value), 0)::text AS total_value
       FROM inventory
       WHERE COALESCE(sold, 0) = 0
       GROUP BY user_id`,
    );
    const cardValues: Record<string, number> = {};
    for (const row of rows) cardValues[row.user_id] = Number(row.total_value);
    return c.json({ success: true, cardValues });
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch card values.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

export default app;
