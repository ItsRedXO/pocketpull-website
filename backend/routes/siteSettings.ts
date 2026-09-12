import { Hono } from 'hono';
import { resolveUserId } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { getSiteSettings, updateSiteSettings, type SiteSettingsUpdateInput } from '../repositories/siteSettings';

const app = new Hono();

async function requireAdmin(c: any) {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]) return;
  }
  const userId = await resolveUserId(c);
  if (!userId) throw new Error('UNAUTHORIZED');
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
}

// Public: the homepage/hero counters read the current ranges to compute what
// they display. No auth needed -- these are display ranges, not secrets.
app.get('/site-settings', async c => {
  return c.json(await getSiteSettings());
});

const RANGE_FIELDS = ['packsOpenedMin', 'packsOpenedMax', 'cardsWonMin', 'cardsWonMax', 'livePlayersMin', 'livePlayersMax'] as const;

app.patch('/admin/site-settings', async c => {
  try {
    await requireAdmin(c);
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Admin access required' }, status);
  }

  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, number> = {};
  for (const key of RANGE_FIELDS) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = Math.round(value);
    }
  }

  const current = await getSiteSettings();
  const merged = { ...current, ...fields };
  if (merged.packsOpenedMax < merged.packsOpenedMin) return c.json({ error: 'Packs Opened max must be greater than or equal to min' }, 400);
  if (merged.cardsWonMax < merged.cardsWonMin) return c.json({ error: 'Cards Won max must be greater than or equal to min' }, 400);
  if (merged.livePlayersMax < merged.livePlayersMin) return c.json({ error: 'Live Players max must be greater than or equal to min' }, 400);

  const updateInput: SiteSettingsUpdateInput = { ...fields };

  if (body.packsOpenedTodayOverride !== undefined) {
    if (body.packsOpenedTodayOverride === null) {
      updateInput.packsOpenedTodayOverride = null;
    } else {
      const value = Number(body.packsOpenedTodayOverride);
      if (!Number.isFinite(value) || value < merged.packsOpenedMin || value > merged.packsOpenedMax) {
        return c.json({ error: `packsOpenedTodayOverride must be between ${merged.packsOpenedMin} and ${merged.packsOpenedMax}` }, 400);
      }
      updateInput.packsOpenedTodayOverride = Math.round(value);
    }
  }
  if (body.cardsWonTodayOverride !== undefined) {
    if (body.cardsWonTodayOverride === null) {
      updateInput.cardsWonTodayOverride = null;
    } else {
      const value = Number(body.cardsWonTodayOverride);
      if (!Number.isFinite(value) || value < merged.cardsWonMin || value > merged.cardsWonMax) {
        return c.json({ error: `cardsWonTodayOverride must be between ${merged.cardsWonMin} and ${merged.cardsWonMax}` }, 400);
      }
      updateInput.cardsWonTodayOverride = Math.round(value);
    }
  }

  const settings = await updateSiteSettings(updateInput);
  return c.json({ success: true, settings });
});

export default app;
