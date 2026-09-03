import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { getBlinkServer, requireAuth } from './lib/auth';
import { query } from './lib/postgres';
import { listUsersByReferrer, countUsersByReferrer, hasDeposit } from './repositories/users';
import stripeRoutes from './routes/stripe';
import coinbaseRoutes from './routes/coinbase';
import packOpeningRoutes from './routes/packOpening';
import upgraderRoutes from './routes/upgrader';
import exchangerRoutes from './routes/exchanger';
import battleRoutes from './routes/battles/index';
import cashoutRoutes from './routes/cashout';
import cashoutAdminRoutes from './routes/cashoutAdmin';
import inventoryRoutes from './routes/inventory';
import upgraderSettingsRoutes from './routes/upgraderSettings';
import sendTestEmailsRoutes from './routes/sendTestEmails';
import logsRoutes from './routes/logs';
import provablyFairRoutes from './routes/provablyFair';
import publicDbProxyRoutes from './routes/publicDbProxy';
import supportDbProxyRoutes from './routes/supportDbProxy';
import userLookupRoutes from './routes/userLookup';
import userDbProxyRoutes from './routes/userDbProxy';
import dbProxyRoutes from './routes/dbProxy';

const app = new Hono();
app.use('*', cors());

app.get('/health', async (c) => {
  try {
    await query('SELECT 1');
    return c.json({ status: 'ok', database: 'postgresql', time: new Date().toISOString(), version: 'v4-postgresql' });
  } catch (error) {
    console.error('[health] PostgreSQL unavailable:', error);
    return c.json({ status: 'degraded', database: 'unavailable', time: new Date().toISOString(), version: 'v4-postgresql' }, 503);
  }
});

app.route('/', publicDbProxyRoutes);
app.route('/', supportDbProxyRoutes);
app.route('/', userLookupRoutes);
app.route('/', userDbProxyRoutes);
app.route('/', dbProxyRoutes);
app.route('/', stripeRoutes);
app.route('/', coinbaseRoutes);
app.route('/', packOpeningRoutes);
app.route('/', upgraderRoutes);
app.route('/', exchangerRoutes);
app.route('/battles', battleRoutes);

function hashDateToTarget(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return 40000 + (Math.abs(h) % 40001);
}

function getDailyPacksOpened() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = now.getTime() - start.getTime();
  let t = Math.min(elapsed / 86400000, 1);
  t = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return Math.floor(hashDateToTarget(`${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`) * t);
}

app.get('/battles/stats', async c => {
  try {
    const rows = await query<{ count: string }>('SELECT count(*)::text count FROM battles WHERE status IN ($1,$2) AND is_public=1', ['waiting', 'live']);
    return c.json({ success: true, liveBattles: Number(rows[0]?.count || 0), packsOpened: getDailyPacksOpened(), timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[battles/stats]', err);
    return c.json({ error: 'Failed to fetch battle stats' }, 500);
  }
});

app.route('/', cashoutRoutes);
app.route('/', cashoutAdminRoutes);
app.route('/', inventoryRoutes);
app.route('/', upgraderSettingsRoutes);
app.route('/', sendTestEmailsRoutes);
app.route('/', logsRoutes);
app.route('/', provablyFairRoutes);

app.get('/referrals', async c => {
  try {
    const userId = await requireAuth(c);
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = 10;
    const offset = (page - 1) * limit;
    const [users, total] = await Promise.all([listUsersByReferrer(userId, limit, offset), countUsersByReferrer(userId)]);
    const data = await Promise.all((users as any[]).map(async u => {
      let status: 'Reward Paid' | 'Deposit Pending' | 'Signed Up' = 'Signed Up', deposited = false;
      if (Number(u.referral_reward_paid || 0) > 0) {
        status = 'Reward Paid';
        deposited = true;
      } else if (await hasDeposit(u.id, 5)) {
        status = 'Deposit Pending';
        deposited = true;
      } else deposited = await hasDeposit(u.id);
      return { id: u.id, username: u.username || u.display_name || 'Trainer', email: Number(u.is_deleted || 0) > 0 ? 'Released' : (u.email || 'Hidden'), status, deposited, createdAt: u.created_at };
    }));
    return c.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Railway-safe replacement for Git LFS-backed branding assets. The PNG files in
// the repository are LFS pointers, so serve the source-controlled SVG instead.
app.get('/pocketpull-logo.png', serveStatic({ path: './dist/pocketpull-logo.svg' }));
app.get('/favicon.png', serveStatic({ path: './dist/pocketpull-logo.svg' }));

// API routes are registered above; only unmatched GET requests reach the frontend.
app.use('*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

export default app;
