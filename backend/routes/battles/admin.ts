import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../../lib/auth';
import { writeLog } from '../logs';
import { processWalletTransaction } from '../../lib/wallet';

const app = new Hono();

/**
 * POST /battles/admin/cancel
 *   - Verifies admin role
 *   - Refunds entry cost to all human players
 *   - Sets battle status to 'canceled'
 */
app.post('/cancel', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    // 1. Fetch user to verify admin role
    const adminUser = await blink.db.users.get(userId) as any;
    if (!adminUser || adminUser.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // 2. Fetch battle
    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    
    if (battle.status === 'finished' || battle.status === 'canceled') {
      return c.json({ error: 'Battle is already finished or canceled' }, 400);
    }

    // 3. Fetch all players to refund
    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    
    // 4. Refund entry cost to all HUMAN players
    const humanPlayers = players.filter((p: any) => !Number(p.isAi));
    const entryCost = Number(battle.totalCost);

    for (const player of humanPlayers) {
      const user = await blink.db.users.get(player.userId) as any;
      if (user) {
        // Look up original wallet ledger to restore matched balance correctly
        const originalLedgerId = `wt_battle_entry_${user.id}_${battleId}`;
        let matchedSpent = 0;
        try {
          const originalEntry = await blink.db.table('walletTransactions').get(originalLedgerId) as any;
          if (originalEntry) {
            matchedSpent = Math.max(0, Number(originalEntry.matchedBefore || 0) - Number(originalEntry.matchedAfter || 0));
          }
        } catch { /* best-effort */ }

        await processWalletTransaction(blink, {
          userId: user.id,
          type: 'battle_entry_refund',
          amount: entryCost,
          matchedAmount: matchedSpent,
          sourceId: battleId,
        });
        
        await blink.db.transactions.create({
          id: `txn_${uid()}`,
          userId: user.id,
          type: 'refund',
          amount: entryCost,
          description: `Admin Refund: Battle ${battleId} cancelled by moderator`,
        });
      }
    }

    // 5. Update battle status
    await blink.db.battles.update(battleId, { 
      status: 'canceled',
      endedAt: new Date().toISOString()
    });

    // 6. Log admin action
    try {
      await writeLog(blink, {
        type: 'battle',
        userId: adminUser.id,
        username: adminUser.username || adminUser.displayName || 'Admin',
        action: 'Admin Battle Cancel',
        details: { 
          battleId, 
          reason: 'Admin cleanup',
          refundedPlayersCount: humanPlayers.length,
          totalRefunded: humanPlayers.length * entryCost
        },
        result: 'success',
      });
    } catch { /* non-critical */ }

    return c.json({ 
      success: true, 
      refundedPlayers: humanPlayers.length,
      totalRefunded: humanPlayers.length * entryCost
    });

  } catch (err: any) {
    console.error('[battles/admin/cancel] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
