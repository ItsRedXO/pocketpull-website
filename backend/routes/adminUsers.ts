import { Hono } from 'hono';
import { query } from '../lib/postgres';
import { requireAuth, uid } from '../lib/auth';
import { processWalletTransaction } from '../repositories/wallet';

const app = new Hono();

async function requireAdmin(c: any): Promise<string> {
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
      metadata: {
        adminUserId,
        mode,
        requestedAmount: amount,
      },
      allowMatchedDebit: false,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error || 'Balance update failed.' }, 400);
    }

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

export default app;
