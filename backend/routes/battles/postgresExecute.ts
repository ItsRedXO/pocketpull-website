import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../../lib/auth';
import { executeBattle } from '../../db/repositories/battleExecute';

const app = new Hono();

/**
 * PostgreSQL battle-execute migration endpoint.
 *
 * This is intentionally isolated from the existing executor. It keeps Blink
 * authentication/authorization while allowing the settlement transaction to
 * run against PostgreSQL during migration verification.
 */
app.post('/execute', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err?.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const { battleId } = await c.req.json();
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.hostUserId !== userId) {
      return c.json({ error: 'Only host can execute battle' }, 403);
    }

    const serverSeed = c.env.BLINK_SERVER_SEED;
    if (!serverSeed) {
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }

    const result = await executeBattle(c.env as any, battleId, serverSeed);
    return c.json(result, (result as any).status || ((result as any).success ? 200 : 500));
  } catch (err: any) {
    console.error('[battles/postgres-execute] error:', err);
    return c.json({ error: err?.message || 'Failed to execute battle' }, 500);
  }
});

export default app;
