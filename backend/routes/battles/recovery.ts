import { Hono } from 'hono';
import { requireAuth, uid } from '../../lib/auth';
import { transaction } from '../../lib/postgres';
import { processWalletTransactionInClient } from '../../repositories/wallet';

const app = new Hono();

/**
 * Recovery/cancellation endpoint. This is intentionally implemented with one
 * PostgreSQL transaction so a refund can never be paid twice, even if the
 * browser retries or the user double-clicks Cancel.
 */
app.post('/cancel', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch { return c.json({ error: 'Authentication required' }, 401); }

  const body = await c.req.json().catch(() => ({}));
  const battleId = String(body?.battleId || '');
  if (!battleId) return c.json({ error: 'battleId required' }, 400);

  try {
    const result = await transaction(async (client) => {
      const battleResult = await client.query('SELECT * FROM battles WHERE id=$1 FOR UPDATE', [battleId]);
      const battle: any = battleResult.rows[0];
      if (!battle) throw Object.assign(new Error('Battle not found'), { status: 404 });
      if (String(battle.host_user_id) !== userId) throw Object.assign(new Error('Only host can cancel'), { status: 403 });
      if (!['waiting', 'starting', 'live'].includes(String(battle.status))) {
        throw Object.assign(new Error('Battle cannot be canceled in its current state'), { status: 400 });
      }

      const playerResult = await client.query('SELECT * FROM battle_players WHERE battle_id=$1', [battleId]);
      const humans = playerResult.rows.filter((p: any) => Number(p.is_ai || 0) === 0);
      if (humans.length > 1) throw Object.assign(new Error('Cannot cancel after another human has joined'), { status: 400 });

      const completed = await client.query(
        `SELECT
          (SELECT COUNT(*) FROM inventory WHERE battle_id=$1) AS inventory_count,
          (SELECT COUNT(*) FROM battle_pull_audits WHERE battle_id=$1) AS audit_count,
          (SELECT COUNT(*) FROM packs_opened WHERE id LIKE $2) AS pull_count`,
        [battleId, `po_%`],
      );
      const row = completed.rows[0];
      if (Number(row.inventory_count) > 0 || Number(row.audit_count) > 0) {
        throw Object.assign(new Error('Battle has already settled and cannot be refunded'), { status: 409 });
      }

      const refundAmount = Number(battle.total_cost || 0);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw Object.assign(new Error('Battle has no refundable entry fee'), { status: 400 });
      }

      const refundSource = `${battleId}:refund`;
      const wallet = await processWalletTransactionInClient(client, {
        userId,
        type: 'battle_entry_refund',
        amount: refundAmount,
        sourceId: refundSource,
        metadata: { battleId, reason: 'battle_cancel_or_recovery' },
      });
      if (!wallet.success) throw Object.assign(new Error(wallet.error || 'Failed to refund balance'), { status: 500 });

      await client.query(
        `UPDATE battles SET status='canceled', ended_at=COALESCE(ended_at,now()), updated_at=now() WHERE id=$1 AND status IN ('waiting','starting','live')`,
        [battleId],
      );
      await client.query('DELETE FROM battle_players WHERE battle_id=$1 AND is_ai=1', [battleId]);
      return { newBalance: wallet.balanceAfter, refundAmount };
    });

    return c.json({ success: true, ...result });
  } catch (err: any) {
    const status = [400,401,403,404,409].includes(Number(err?.status)) ? Number(err.status) : 500;
    console.error('[battles/recovery/cancel] error:', err?.message || err);
    return c.json({ error: err?.message || 'Failed to cancel battle' }, status as any);
  }
});

export default app;
