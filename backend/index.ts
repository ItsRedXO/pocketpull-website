import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getBlinkServer } from './lib/auth';
import { checkDatabaseConnection } from './db/client';
import { countLivePublicBattles } from './db/repositories/battles';

// Route modules
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

// Enable CORS for all routes
app.use('*', cors());

// Health check: API + PostgreSQL connectivity.
app.get('/health', async (c) => {
  try {
    await checkDatabaseConnection(c.env as any);
    return c.json({
      status: 'ok',
      database: 'ok',
      time: new Date().toISOString(),
      version: 'v4-postgres-migration',
    });
  } catch (err: any) {
    console.error('[health] PostgreSQL connection failed:', err?.message || err);
    return c.json({
      status: 'degraded',
      database: 'error',
      time: new Date().toISOString(),
      version: 'v4-postgres-migration',
    }, 503);
  }
});

// Payment routes
app.route('/', stripeRoutes);
app.route('/', coinbaseRoutes);

// Economy routes
app.route('/', packOpeningRoutes);
app.route('/', upgraderRoutes);
app.route('/', exchangerRoutes);
app.route('/battles', battleRoutes);

function hashDateToTarget(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return 40000 + (Math.abs(hash) % 40001);
}

function getDailyPacksOpened(): number {
  const pacificNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const startOfDay = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate());
  const elapsedMs = pacificNow.getTime() - startOfDay.getTime();
  const totalMsInDay = 86400000;

  const dateSeed = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`;
  const target = hashDateToTarget(dateSeed);

  let t = Math.min(elapsedMs / totalMsInDay, 1);
  if (t < 0.5) {
    t = 4 * t * t * t;
  } else {
    t = 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  return Math.floor(target * t);
}

// Same API response as before; source of truth for live battle count is PostgreSQL.
app.get('/battles/stats', async (c) => {
  try {
    const liveBattlesCount = await countLivePublicBattles(c.env as any);
    const packsOpened = getDailyPacksOpened();

    return c.json({
      success: true,
      liveBattles: liveBattlesCount,
      packsOpened,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[battles/stats] error:', err.message);
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

// Referrals remain on Blink during this migration slice. Authentication remains
// Blink-backed until PostgreSQL data access is fully verified.
app.get('/referrals', async (c) => {
  const blink = getBlinkServer(c.env as any);
  const authHeader = c.req.header('Authorization');
  const auth = await blink.auth.verifyToken(authHeader);
  if (!auth.valid || !auth.userId) return c.json({ error: 'Unauthorized' }, 401);

  const userId = auth.userId;
  const page = parseInt(c.req.query('page') || '1');
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    const referredUsers = await blink.db.users.list({
      where: { referredById: userId },
      orderBy: { createdAt: 'desc' },
      limit,
      offset,
    });

    const total = await blink.db.users.count({ where: { referredById: userId } });

    const data = await Promise.all((referredUsers as any[]).map(async (u) => {
      let status: 'Reward Paid' | 'Deposit Pending' | 'Signed Up' = 'Signed Up';
      let deposited = false;

      if (u.referralRewardPaid || Number(u.referralRewardPaid) > 0) {
        status = 'Reward Paid';
        deposited = true;
      } else {
        const qualifyingDeposit = await blink.db.transactions.exists({
          where: { userId: u.id, type: 'deposit', amount: { gte: 5 } },
        });

        if (qualifyingDeposit) {
          status = 'Deposit Pending';
          deposited = true;
        } else {
          const anyDeposit = await blink.db.transactions.exists({
            where: { userId: u.id, type: 'deposit' },
          });
          if (anyDeposit) deposited = true;
        }
      }

      return {
        id: u.id,
        username: u.username || u.displayName || 'Trainer',
        email: u.isDeleted ? 'Released' : (u.email || 'Hidden'),
        status,
        deposited,
        createdAt: u.createdAt,
      };
    }));

    return c.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
