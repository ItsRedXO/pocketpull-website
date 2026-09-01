import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { exchangeCards } from '../db/repositories/exchanger';

const app = new Hono();

app.post('/exchanger/trade', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    if (err.message === 'ACCOUNT_BANNED') return c.json({ error: 'Account banned' }, 403);
    if (err.message === 'USER_NOT_FOUND') return c.json({ error: 'User not found' }, 404);
    return c.json({ error: 'Authentication required' }, 401);
  }
  try {
    const body = await c.req.json();
    const { offerInventoryIds, receivePackCardIds } = body;
    if (!Array.isArray(offerInventoryIds) || offerInventoryIds.length === 0) return c.json({ error: 'offerInventoryIds required' }, 400);
    if (!Array.isArray(receivePackCardIds) || receivePackCardIds.length === 0) return c.json({ error: 'receivePackCardIds required' }, 400);
    const result = await exchangeCards(c.env as any, userId, offerInventoryIds.map(String), receivePackCardIds.map(String));
    if (!result.success) {
      const status = result.error === 'Account deactivated' || result.error === 'Account banned' ? 403 :
        result.error === 'User not found' ? 404 : 400;
      return c.json({ error: result.error }, status as any);
    }
    return c.json(result);
  } catch (err: any) {
    console.error('[exchanger/trade] error:', err?.message || err);
    return c.json({ error: err?.message || 'Internal server error' }, 500);
  }
});

export default app;
