import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../lib/auth';

const app = new Hono();

async function requireAdmin(c: any): Promise<{ userId: string; db: any }> {
  const blink = getBlinkServer(c.env as any);
  const adminPassword = c.req.header('X-Admin-Password');
  if (adminPassword) {
    const rows = await blink.db.adminCredentials.list({});
    const match = (rows as any[]).find((r) => (r.adminPass ?? r.admin_pass ?? '') === adminPassword);
    if (match) return { userId: 'admin_credentials', db: blink.db };
  }
  const userId = await requireAuth(c);
  const user = await blink.db.users.get(userId) as any;
  if (!user || user.role !== 'admin') throw new Error('FORBIDDEN');
  return { userId, db: blink.db };
}

app.use('/admin/packs/*', async (c, next) => {
  try { await requireAdmin(c); await next(); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    if (err.message === 'FORBIDDEN') return c.json({ error: 'Admin access required' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
});

app.get('/admin/packs', async (c) => {
  try {
    const { db } = await requireAdmin(c);
    const packs = await db.packsCatalog.list({ orderBy: { sortOrder: 'asc' } });
    const cards = await db.packCards.list({ orderBy: { sortOrder: 'asc' } });
    return c.json({ packs, cards });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to load packs' }, 500);
  }
});

app.post('/admin/packs', async (c) => {
  try {
    const { db } = await requireAdmin(c);
    const body = await c.req.json();
    const { pack, cards = [] } = body;
    if (!pack?.id || !pack?.name) return c.json({ error: 'Pack id and name are required' }, 400);
    await db.packsCatalog.upsert(pack);
    if (cards.length) await db.packCards.createMany(cards);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to save pack' }, 500);
  }
});

app.patch('/admin/packs/:id', async (c) => {
  try {
    const { db } = await requireAdmin(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.packsCatalog.update(id, body);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to update pack' }, 500);
  }
});

app.delete('/admin/packs/:id', async (c) => {
  try {
    const { db } = await requireAdmin(c);
    const id = c.req.param('id');
    await db.packCards.deleteMany({ where: { packId: id } });
    await db.packsCatalog.delete(id);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to delete pack' }, 500);
  }
});

export default app;
