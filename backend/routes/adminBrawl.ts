import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { computeOverallRating } from '../lib/brawl/rating';
import { listAllSpecies, updateSpecies } from '../repositories/brawl';

const app = new Hono();

async function requireAdmin(c: any): Promise<string> {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return rows[0].id;
  }
  const userId = await requireAuth(c);
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
  return userId;
}
async function admin(c: any) { try { return await requireAdmin(c); } catch { return c.json({ error: 'Admin access required' }, 403); } }

app.get('/admin/brawl/species', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ species: await listAllSpecies() });
});

app.patch('/admin/brawl/species/:id', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid species id' }, 400);
  const body = await c.req.json().catch(() => ({}));

  const fields: Record<string, unknown> = {};
  for (const key of ['name', 'primary_type', 'secondary_type', 'sprite_url', 'artwork_url'] as const) {
    if (body[key] !== undefined) fields[key] = body[key] || null;
  }
  const statFields = ['base_hp', 'base_attack', 'base_defense', 'base_sp_attack', 'base_sp_defense', 'base_speed'] as const;
  let statsChanged = false;
  for (const key of statFields) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = Math.round(value);
      statsChanged = true;
    }
  }
  if (body.overall_rating !== undefined) {
    const value = Number(body.overall_rating);
    if (!Number.isFinite(value) || value < 0) return c.json({ error: 'Invalid overall_rating' }, 400);
    fields.overall_rating = Math.round(value);
  } else if (statsChanged) {
    const current = (await listAllSpecies()).find(s => s.id === id);
    if (current) {
      const merged = { ...current, ...fields } as any;
      fields.overall_rating = computeOverallRating({
        hp: merged.base_hp, attack: merged.base_attack, defense: merged.base_defense,
        spAttack: merged.base_sp_attack, spDefense: merged.base_sp_defense, speed: merged.base_speed,
      });
    }
  }

  const updated = await updateSpecies(id, fields);
  if (!updated) return c.json({ error: 'Species not found' }, 404);
  return c.json({ success: true, species: updated });
});

export default app;
