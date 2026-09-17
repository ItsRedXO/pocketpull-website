import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { listPromoCodes, createPromoCode, updatePromoCode, redeemPromoCode, listPromoCodeRedemptions } from '../repositories/promoCodes';
import { getDealSettings, updateDealSettings } from '../repositories/dealSettings';

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

app.get('/admin/promo-codes', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ codes: await listPromoCodes() });
});

app.post('/admin/promo-codes', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  if (!code) return c.json({ error: 'Code is required' }, 400);
  const rewardAmount = Number(body.rewardAmount);
  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) return c.json({ error: 'Reward amount must be a positive number' }, 400);
  let maxUses: number | null = null;
  if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== '') {
    maxUses = Number(body.maxUses);
    if (!Number.isInteger(maxUses) || maxUses <= 0) return c.json({ error: 'Max uses must be a positive whole number, or left blank for unlimited' }, 400);
  }
  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) return c.json({ error: 'Invalid expiration date' }, 400);
    expiresAt = d.toISOString();
  }
  try {
    const created = await createPromoCode({ code, description: body.description || null, rewardAmount, maxUses, expiresAt, createdBy: adminId });
    return c.json({ success: true, promoCode: created });
  } catch (e: any) {
    if (e?.code === '23505') return c.json({ error: 'A code with that text already exists' }, 409);
    return c.json({ error: e?.message || 'Failed to create code' }, 500);
  }
});

app.patch('/admin/promo-codes/:id', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  if (body.description !== undefined) fields.description = body.description || null;
  if (body.isActive !== undefined) fields.isActive = !!body.isActive;
  if (body.rewardAmount !== undefined) {
    const value = Number(body.rewardAmount);
    if (!Number.isFinite(value) || value <= 0) return c.json({ error: 'Reward amount must be a positive number' }, 400);
    fields.rewardAmount = value;
  }
  if (body.maxUses !== undefined) {
    if (body.maxUses === null || body.maxUses === '') fields.maxUses = null;
    else {
      const value = Number(body.maxUses);
      if (!Number.isInteger(value) || value <= 0) return c.json({ error: 'Max uses must be a positive whole number, or left blank for unlimited' }, 400);
      fields.maxUses = value;
    }
  }
  if (body.expiresAt !== undefined) {
    if (!body.expiresAt) fields.expiresAt = null;
    else {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) return c.json({ error: 'Invalid expiration date' }, 400);
      fields.expiresAt = d.toISOString();
    }
  }
  const updated = await updatePromoCode(id, fields);
  if (!updated) return c.json({ error: 'Code not found' }, 404);
  return c.json({ success: true, promoCode: updated });
});

app.get('/admin/promo-codes/:id/redemptions', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ redemptions: await listPromoCodeRedemptions(c.req.param('id')) });
});

app.get('/admin/deal-settings', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json(await getDealSettings());
});

app.patch('/admin/deal-settings', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, number> = {};
  for (const [bodyKey, col] of [['depositMatchPercent', 'depositMatchPercent'], ['depositMatchCap', 'depositMatchCap'], ['referralRewardAmount', 'referralRewardAmount']] as const) {
    if (body[bodyKey] !== undefined) {
      const value = Number(body[bodyKey]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${bodyKey}` }, 400);
      fields[col] = value;
    }
  }
  const settings = await updateDealSettings(fields);
  return c.json({ success: true, settings });
});

app.post('/redeem-code', async c => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Please sign in to redeem a code' }, 401); }
  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code || '');
  if (!code.trim()) return c.json({ error: 'Enter a code' }, 400);
  const result = await redeemPromoCode(userId, code);
  if (!result.success) return c.json({ error: result.error }, 400);
  return c.json(result);
});

export default app;
