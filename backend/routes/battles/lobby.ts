import { Hono } from 'hono';
import { requireAuth } from '../../lib/auth';
import { getBattleLobby, getBattleState } from '../../db/repositories/battles';
import { createBattle } from '../../db/repositories/battleCreate';

const app = new Hono();

app.get('/lobby', async (c) => {
  const userId = c.req.query('userId');
  try {
    const data = await getBattleLobby(c.env as any, userId || null);
    return c.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[battles/lobby] postgres error:', err.message);
    return c.json({ error: 'Failed to fetch lobby data' }, 500);
  }
});

app.get('/state', async (c) => {
  try { await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  const battleId = c.req.query('battleId');
  if (!battleId) return c.json({ error: 'battleId required' }, 400);
  try {
    const data = await getBattleState(c.env as any, battleId);
    if (!data) return c.json({ error: 'Battle not found' }, 404);
    return c.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[battles/state] postgres error:', err.message);
    return c.json({ error: 'Failed to fetch battle state' }, 500);
  }
});

app.post('/create', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    if (err.message === 'ACCOUNT_BANNED') return c.json({ error: 'Account banned' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
  try {
    const body = await c.req.json();
    const { selectedPackIds, mode, playerCount, isPublic, teamMode } = body;
    if (!Array.isArray(selectedPackIds) || selectedPackIds.length === 0) return c.json({ error: 'selectedPackIds required' }, 400);
    const result = await createBattle(c.env as any, { userId, selectedPackIds: selectedPackIds.map(String), mode, playerCount, isPublic, teamMode });
    if (!result.success) return c.json({ error: result.error }, (result.status || 500) as any);
    return c.json(result);
  } catch (err: any) {
    console.error('[battles/create] postgres error:', err?.message || err);
    return c.json({ error: err?.message || 'Internal server error' }, 500);
  }
});

export default app;
