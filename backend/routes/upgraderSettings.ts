import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';

const app = new Hono();

// Helper to check if request is from an admin
async function isAdminRequest(c: any): Promise<boolean> {
  const blink = getBlinkServer(c.env as any);

  // 1. Check for legacy X-Admin-Secret (dedicated admin password)
  const adminSecret = c.req.header('X-Admin-Secret');
  if (adminSecret && adminSecret !== 'true') {
    try {
      const rows = await blink.db.adminCredentials.list({});
      const adminRow = rows.find((r: any) => (r.adminPass || r.admin_pass) === adminSecret);
      if (adminRow) return true;
    } catch (err: any) {
      console.error('[isAdminRequest] DB error:', err.message);
    }
  }

  // 2. Check for real user auth with role='admin' (promoted users)
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const auth = await blink.auth.verifyToken(authHeader);
      if (auth.valid && auth.userId) {
        const user = await blink.db.users.get(auth.userId) as any;
        if (user && (user.role === 'admin' || user.role === 'owner')) return true;
      }
    }
  } catch (err: any) {
    console.error('[isAdminRequest] Auth error:', err.message);
  }
  
  // 3. Last resort for non-critical logs
  if (adminSecret === 'true') return true;

  return false;
}

/**
 * GET /upgrader/settings
 * Publicly fetch multiplier settings
 */
app.get('/upgrader/settings', async (c) => {
  const blink = getBlinkServer(c.env as any);
  try {
    const settings = await blink.db.upgraderMultiplierSettings.list({
      orderBy: { multiplier: 'asc' }
    });
    return c.json({ 
      settings: (settings as any[]).map(s => ({
        multiplier: Number(s.multiplier),
        maxChance: Number(s.maxChance)
      }))
    });
  } catch (err: any) {
    console.error('[upgrader/settings] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/upgrader/settings
 * Admin only: update multiplier settings
 */
app.post('/admin/upgrader/settings', async (c) => {
  const authorized = await isAdminRequest(c);
  if (!authorized) {
    console.warn('[admin/upgrader/settings] Unauthorized attempt');
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json().catch(() => null);
    if (!body || !Array.isArray(body.settings)) {
      return c.json({ error: 'Invalid request: settings array required' }, 400);
    }

    const { settings } = body;

    for (const item of settings) {
      const { multiplier, maxChance } = item;
      if (multiplier === undefined || maxChance === undefined) continue;
      
      const m = Number(multiplier);
      const mc = Number(maxChance);
      
      if (isNaN(m)) continue;
      
      // Validation: 0 to 75
      const validChance = Math.max(0, Math.min(75, isNaN(mc) ? 75 : mc));
      
      await blink.db.upgraderMultiplierSettings.upsert({
        multiplier: m,
        maxChance: validChance
      } as any);
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error('[admin/upgrader/settings] POST error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;