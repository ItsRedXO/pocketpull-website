import { Hono } from 'hono';
import { requireAuth } from '../../lib/auth';
import { transaction } from '../../lib/postgres';
import { processWalletTransactionInClient } from '../../repositories/wallet';

const app = new Hono();

/**
 * Recovery/cancellation endpoint.
 *
 * The battle row is locked for the entire operation, settlement evidence is
 * checked before any refund, and every refund uses a participant-specific
 * idempotency source. Repeated requests therefore cannot mint extra balance.
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

      // Make retries harmless. Once canceled, return the already-settled refund
      // state without creating any new wallet entries.
      if (String(battle.status) === 'canceled') {
        const prior = await client.query(
          `SELECT COALESCE(SUM(amount),0) AS refunded
           FROM wallet_transactions
           WHERE type='battle_entry_refund' AND source_id LIKE $1`,
          [`${battleId}:refund:%`],
        );
        const user = await client.query('SELECT balance FROM users WHERE id=$1', [userId]);
        return {
          alreadyCanceled: true,
          newBalance: Number(user.rows[0]?.balance || 0),
          refundAmount: Number(prior.rows[0]?.refunded || 0),
          refundedPlayers: 0,
        };
      }

      if (!['waiting', 'starting', 'live'].includes(String(battle.status))) {
        throw Object.assign(new Error('Battle cannot be canceled in its current state'), { status: 400 });
      }

      const playerResult = await client.query('SELECT * FROM battle_players WHERE battle_id=$1 ORDER BY joined_at,id', [battleId]);
      const humans = playerResult.rows.filter((p: any) => Number(p.is_ai || 0) === 0);
      if (humans.length === 0) throw Object.assign(new Error('Battle has no refundable human participants'), { status: 400 });

      // If execution is actively committing, the FOR UPDATE above waits for it.
      // After the lock is acquired, any persisted reward/audit means the battle
      // has settled and a cancellation refund must be rejected.
      const completed = await client.query(
        `SELECT
          (SELECT COUNT(*) FROM inventory WHERE battle_id=$1) AS inventory_count,
          (SELECT COUNT(*) FROM battle_pull_audits WHERE battle_id=$1) AS audit_count`,
        [battleId],
      );
      const row = completed.rows[0];
      if (Number(row.inventory_count) > 0 || Number(row.audit_count) > 0) {
        throw Object.assign(new Error('Battle has already settled and cannot be refunded'), { status: 409 });
      }

      let totalRefunded = 0;
      let refundedPlayers = 0;
      let hostBalance = 0;

      for (const human of humans) {
        const humanUserId = String(human.user_id || '');
        if (!humanUserId) continue;

        // Refund only a participant who has an authoritative battle-entry debit.
        // This prevents a forged/stale player row from ever creating free money.
        const entryResult = await client.query(
          `SELECT amount,matched_before,matched_after
           FROM wallet_transactions
           WHERE user_id=$1 AND source_id=$2 AND type='battle_entry'
           ORDER BY created_at ASC
           LIMIT 1`,
          [humanUserId, battleId],
        );
        const entry = entryResult.rows[0];
        if (!entry) {
          throw Object.assign(new Error(`Missing battle entry ledger for participant ${humanUserId}`), { status: 409 });
        }

        const entryAmount = Number(entry.amount || 0);
        const refundAmount = Math.abs(Math.min(0, entryAmount));
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          throw Object.assign(new Error(`Invalid battle entry ledger for participant ${humanUserId}`), { status: 409 });
        }

        const matchedSpent = Math.max(0, Number(entry.matched_before || 0) - Number(entry.matched_after || 0));
        const refundSource = `${battleId}:refund:${human.user_id}`;
        const wallet = await processWalletTransactionInClient(client, {
          userId: humanUserId,
          type: 'battle_entry_refund',
          amount: refundAmount,
          matchedAmount: Math.min(refundAmount, matchedSpent),
          sourceId: refundSource,
          metadata: { battleId, reason: 'battle_cancel_or_recovery', originalEntrySource: battleId },
        });
        if (!wallet.success) throw Object.assign(new Error(wallet.error || 'Failed to refund balance'), { status: 500 });

        totalRefunded += refundAmount;
        refundedPlayers += 1;
        if (humanUserId === userId) hostBalance = wallet.balanceAfter;
      }

      await client.query(
        `UPDATE battles
         SET status='canceled', ended_at=COALESCE(ended_at,now()), updated_at=now()
         WHERE id=$1 AND status IN ('waiting','starting','live')`,
        [battleId],
      );
      await client.query('DELETE FROM battle_players WHERE battle_id=$1 AND is_ai=1', [battleId]);

      return {
        alreadyCanceled: false,
        newBalance: hostBalance,
        refundAmount: totalRefunded,
        refundedPlayers,
      };
    });

    return c.json({ success: true, ...result });
  } catch (err: any) {
    const status = [400,401,403,404,409].includes(Number(err?.status)) ? Number(err.status) : 500;
    console.error('[battles/recovery/cancel] error:', err?.message || err);
    return c.json({ error: err?.message || 'Failed to cancel battle' }, status as any);
  }
});

export default app;
