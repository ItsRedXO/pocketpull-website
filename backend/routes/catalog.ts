import { Hono } from 'hono';
import { getBlinkServer, requireAuth } from '../lib/auth';

const app = new Hono();

app.get('/catalog/packs', async (c) => {
  try {
    const db = getBlinkServer(c.env as any).db;
    const packs = await db.packsCatalog.list({ where: { isActive: 1 }, orderBy: { price: 'asc' } });
    return c.json({ packs });
  } catch (err: any) {
    console.error('[catalog/packs]', err);
    return c.json({ error: 'Failed to load packs' }, 500);
  }
});

app.get('/catalog/packs/:packId/cards', async (c) => {
  try {
    const db = getBlinkServer(c.env as any).db;
    const pack = await db.packsCatalog.get(c.req.param('packId')) as any;
    if (!pack || Number(pack.isActive) !== 1) return c.json({ error: 'Pack not found' }, 404);
    const cards = await db.packCards.list({ where: { packId: pack.id }, orderBy: { sortOrder: 'asc' } });
    return c.json({ cards });
  } catch (err: any) {
    console.error('[catalog/pack-cards]', err);
    return c.json({ error: 'Failed to load pack cards' }, 500);
  }
});

app.get('/catalog/cooldowns', async (c) => {
  try {
    const userId = await requireAuth(c);
    const db = getBlinkServer(c.env as any).db;
    const rows = await db.packCooldowns.list({ where: { userId } });
    return c.json({ cooldowns: rows });
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
});

export default app;
