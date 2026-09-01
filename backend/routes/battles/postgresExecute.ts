import { Hono } from 'hono';
import { requireAuth } from '../../lib/auth';
import { executeBattle } from '../../db/repositories/battleExecute';
import { getBattleState } from '../../db/repositories/battles';

const app = new Hono();

/**
 * PostgreSQL battle-execute migration endpoint.
 *
 * Blink is retained only for authentication. Battle authorization and
 * settlement are both read from PostgreSQL so this endpoint exercises the
 * migrated data path end-to-end.
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

  try {
    const { battleId } = await c.req.json();
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const state = await getBattleState(c.env as any, battleId);
    if (!state) return c.json({ error: 'Battle not found' }, 404);

    const battle = state.battle as any;
    if (battle.hostUserId !== userId && battle.host_user_id !== userId) {
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
