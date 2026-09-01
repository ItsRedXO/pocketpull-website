import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { spinUpgrader } from '../db/repositories/upgrader';
import { sha256 } from '../lib/provablyFair';

const app = new Hono();

app.post('/upgrader/spin', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    if (err.message === 'ACCOUNT_BANNED') return c.json({ error: 'Account banned' }, 403);
    if (err.message === 'USER_NOT_FOUND') return c.json({ error: 'User not found' }, 404);
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { inventoryIds, targetCardIds, useBalance, addedBalance, multiplier } = body;
    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) return c.json({ error: 'inventoryIds required' }, 400);
    if (!Array.isArray(targetCardIds) || targetCardIds.length === 0) return c.json({ error: 'targetCardIds required' }, 400);

    const numericMultiplier = Number(multiplier);
    if (!Number.isFinite(numericMultiplier) || numericMultiplier <= 0) return c.json({ error: 'Invalid multiplier' }, 400);

    const serverSeed = c.env.BLINK_SERVER_SEED;
    if (!serverSeed) {
      console.error('[upgrader/spin] BLINK_SERVER_SEED is not configured');
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }
    const serverSeedHash = await sha256(serverSeed);
    const clientSeed = `cs_${crypto.randomUUID()}`;

    const result = await spinUpgrader(c.env as any, {
      userId,
      inventoryIds: inventoryIds.map(String),
      targetCardIds: targetCardIds.map(String),
      useBalance: Boolean(useBalance),
      addedBalance: Number(addedBalance) || 0,
      multiplier: numericMultiplier,
      serverSeed,
      serverSeedHash,
      clientSeed,
    });

    if (!result.success) {
      const status = result.error === 'Account deactivated' || result.error === 'Account banned' ? 403 :
        result.error?.includes('not found') || result.error?.includes('inventory') || result.error?.includes('Target card') || result.error?.includes('Minimum') || result.error?.includes('Target value') ? 400 : 500;
      return c.json({ error: result.error || 'Internal server error' }, status as any);
    }

    return c.json({
      success: true,
      isWin: result.isWin,
      winChance: result.winChance,
      wonCards: result.wonCards,
      targetCards: result.targetCards,
      newBalance: result.newBalance,
      removedCardIds: result.removedCardIds,
    });
  } catch (err: any) {
    console.error('[upgrader/spin] error:', err?.message || err);
    return c.json({ error: err?.message || 'Internal server error' }, 500);
  }
});

export default app;
