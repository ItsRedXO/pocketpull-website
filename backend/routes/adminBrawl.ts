import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { computeOverallRating } from '../lib/brawl/rating';
import {
  listAllSpecies, updateSpecies, searchBrawlUsers, getOrCreateProfile, getWalletBalance, listInstancesForUser,
  adminSetProfileFields, applyBrawlWalletTransaction, insertInstances, adminDeleteInstance, setTeam,
} from '../repositories/brawl';

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
  }
  for (const key of ['portrait_scale', 'portrait_offset_x', 'portrait_offset_y'] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value)) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = value;
    }
  }
  if (body.overall_rating === undefined && statsChanged) {
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

app.get('/admin/brawl/users', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const search = c.req.query('search') || '';
  return c.json({ users: await searchBrawlUsers(search) });
});

app.get('/admin/brawl/users/:userId', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const rows = await query<{ id: string; username: string | null; avatar_url: string | null }>('SELECT id, username, avatar_url FROM users WHERE id=$1', [userId]);
  if (!rows[0]) return c.json({ error: 'User not found' }, 404);
  const [profile, balance, roster] = await Promise.all([getOrCreateProfile(userId), getWalletBalance(userId), listInstancesForUser(userId)]);
  return c.json({ user: rows[0], profile, balance, roster });
});

const PROFILE_NUMBER_FIELDS = ['league_rating', 'wins', 'losses', 'local_battles_played', 'local_tournament_wins', 'state_tournament_wins', 'regional_tournament_wins', 'elite_four_wins'] as const;
app.patch('/admin/brawl/users/:userId/profile', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  for (const key of PROFILE_NUMBER_FIELDS) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = Math.round(value);
    }
  }
  if (body.has_completed_intro !== undefined) fields.has_completed_intro = body.has_completed_intro ? 1 : 0;
  if (body.league !== undefined) fields.league = String(body.league);
  const profile = await adminSetProfileFields(userId, fields);
  return c.json({ success: true, profile });
});

app.post('/admin/brawl/users/:userId/wallet', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { amount, reason } = await c.req.json().catch(() => ({}));
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) return c.json({ error: 'amount must be a non-zero number' }, 400);
  try {
    const result = await applyBrawlWalletTransaction(userId, 'admin_adjustment', Math.round(delta), `admin:${adminId}:${Date.now()}`, { adminId, reason: reason || null });
    return c.json({ success: true, balance: result.balanceAfter });
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_POKEDOLLARS') return c.json({ error: 'That would take the balance below 0' }, 400);
    throw e;
  }
});

app.post('/admin/brawl/users/:userId/instances', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { speciesId } = await c.req.json().catch(() => ({}));
  const id = Number(speciesId);
  if (!Number.isInteger(id)) return c.json({ error: 'speciesId is required' }, 400);
  const species = await listAllSpecies();
  if (!species.some(s => s.id === id)) return c.json({ error: 'Unknown species id' }, 404);
  const [instanceId] = await insertInstances(userId, [id], 'admin');
  return c.json({ success: true, instanceId, roster: await listInstancesForUser(userId) });
});

app.delete('/admin/brawl/users/:userId/instances/:instanceId', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const deleted = await adminDeleteInstance(userId, c.req.param('instanceId'));
  if (!deleted) return c.json({ error: 'Pokemon not found on this trainer' }, 404);
  return c.json({ success: true, roster: await listInstancesForUser(userId) });
});

app.put('/admin/brawl/users/:userId/team', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { instanceIds } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(instanceIds) || instanceIds.length < 1 || instanceIds.length > 6) return c.json({ error: 'Select 1-6 Pokemon for the active team' }, 400);
  try { await setTeam(userId, instanceIds); } catch (e: any) { return c.json({ error: e.message === 'INVALID_TEAM_SELECTION' ? 'One or more selected Pokemon are not owned by this trainer' : 'Failed to update team' }, 400); }
  return c.json({ success: true, roster: await listInstancesForUser(userId) });
});

export default app;
