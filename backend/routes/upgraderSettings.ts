import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { getDb } from '../db/client';
import { getUserProfile } from '../db/repositories/users';

const app = new Hono();

app.get('/upgrader/settings', async (c) => {
  try {
    const rows = await getDb(c.env as any).query(`SELECT multiplier,max_chance FROM upgrader_multiplier_settings ORDER BY multiplier ASC`);
    return c.json({ settings: rows.rows.map((row: any) => ({ multiplier: Number(row.multiplier), maxChance: Number(row.max_chance) })) });
  } catch (err: any) { return c.json({ error: err?.message || 'Internal server error' }, 500); }
});

app.post('/admin/upgrader/settings', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Unauthorized' }, 401); }
  try {
    const admin = await getUserProfile(c.env as any, userId);
    if (!admin || !['admin','owner'].includes(admin.role)) return c.json({ error: 'Unauthorized' }, 403);
    const body = await c.req.json().catch(() => null);
    if (!body || !Array.isArray(body.settings)) return c.json({ error: 'Invalid request: settings array required' }, 400);
    const db = getDb(c.env as any);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const item of body.settings) {
        const multiplier = Number(item.multiplier);
        if (!Number.isFinite(multiplier)) continue;
        const maxChance = Math.max(0, Math.min(75, Number.isFinite(Number(item.maxChance)) ? Number(item.maxChance) : 75));
        await client.query(`INSERT INTO upgrader_multiplier_settings (multiplier,max_chance) VALUES ($1,$2) ON CONFLICT (multiplier) DO UPDATE SET max_chance=EXCLUDED.max_chance`, [multiplier, maxChance]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err?.message || 'Internal server error' }, 500); }
});

export default app;
