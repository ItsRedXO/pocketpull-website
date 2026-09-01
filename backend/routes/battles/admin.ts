import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../../lib/auth';
import { cancelBattle } from '../../db/repositories/battleAdmin';
import { writeLog } from '../logs';

const app = new Hono();

app.post('/cancel', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch { return c.json({ error: 'Authentication required' }, 401); }
  try {
    const { battleId } = await c.req.json();
    if (!battleId) return c.json({ error: 'battleId required' }, 400);
    const result = await cancelBattle(c.env as any, battleId, userId);
    const blink = getBlinkServer(c.env as any);
    await writeLog(blink, { type: 'battle', userId, username: 'Admin', action: 'Admin Battle Cancel', details: { battleId, refundedPlayersCount: result.refundedPlayers, totalRefunded: result.totalRefunded }, result: 'success' });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.message === 'Admin access required' ? 403 : err?.message === 'Battle not found' ? 404 : 400;
    return c.json({ error: err?.message || 'Internal server error' }, status as any);
  }
});

export default app;
