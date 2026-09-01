import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './lib/auth';
import { checkDatabaseConnection } from './db/client';
import { countLivePublicBattles } from './db/repositories/battles';
import { listReferredUsers, hasDepositOfAtLeast } from './db/repositories/users';
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

const app = new Hono();
app.use('*', cors());

app.get('/health', async (c) => {
  try { await checkDatabaseConnection(c.env as any); return c.json({ status: 'ok', database: 'ok', time: new Date().toISOString(), version: 'v4-postgres-migration' }); }
  catch (err: any) { console.error('[health] PostgreSQL connection failed:', err?.message || err); return c.json({ status: 'degraded', database: 'error', time: new Date().toISOString(), version: 'v4-postgres-migration' }, 503); }
});

app.route('/', stripeRoutes);
app.route('/', coinbaseRoutes);
app.route('/', packOpeningRoutes);
app.route('/', upgraderRoutes);
app.route('/', exchangerRoutes);
app.route('/battles', battleRoutes);

function hashDateToTarget(dateStr: string): number { let hash = 0; for (let i = 0; i < dateStr.length; i++) { hash = ((hash << 5) - hash) + dateStr.charCodeAt(i); hash |= 0; } return 40000 + (Math.abs(hash) % 40001); }
function getDailyPacksOpened(): number {
  const pacificNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const startOfDay = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate());
  const elapsedMs = pacificNow.getTime() - startOfDay.getTime();
  const dateSeed = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`;
  const target = hashDateToTarget(dateSeed); let t = Math.min(elapsedMs / 86400000, 1);
  t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return Math.floor(target * t);
}

app.get('/battles/stats', async (c) => {
  try { return c.json({ success: true, liveBattles: await countLivePublicBattles(c.env as any), packsOpened: getDailyPacksOpened(), timestamp: new Date().toISOString() }); }
  catch (err: any) { console.error('[battles/stats] error:', err.message); return c.json({ error: 'Failed to fetch battle stats' }, 500); }
});

app.route('/', cashoutRoutes);
app.route('/', cashoutAdminRoutes);
app.route('/', inventoryRoutes);
app.route('/', upgraderSettingsRoutes);
app.route('/', sendTestEmailsRoutes);
app.route('/', logsRoutes);
app.route('/', provablyFairRoutes);

app.get('/referrals', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); } catch { return c.json({ error: 'Unauthorized' }, 401); }
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const limit = 10;
  try {
    const result = await listReferredUsers(c.env as any, userId, limit, (page - 1) * limit);
    const data = await Promise.all(result.rows.map(async (u: any) => {
      const paid = Boolean(u.referral_reward_paid);
      const qualifying = await hasDepositOfAtLeast(c.env as any, u.id, 5);
      const anyDeposit = await hasDepositOfAtLeast(c.env as any, u.id, 0.01);
      return { id: u.id, username: u.username || u.display_name || 'Trainer', email: u.is_deleted ? 'Released' : (u.email || 'Hidden'), status: paid ? 'Reward Paid' : qualifying ? 'Deposit Pending' : 'Signed Up', deposited: qualifying || anyDeposit, createdAt: u.created_at };
    }));
    return c.json({ data, total: result.total, page, totalPages: Math.ceil(result.total / limit) });
  } catch (err: any) { return c.json({ error: err?.message || 'Failed to fetch referrals' }, 500); }
});

export default app;
