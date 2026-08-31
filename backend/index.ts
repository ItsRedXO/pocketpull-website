import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@blinkdotnew/sdk';
import { getBlinkServer } from './lib/auth';

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

// ──────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString(), version: 'v3-provably-fair' }));

// ──────────────────────────────────────────────────────────────
// Payment routes
// ──────────────────────────────────────────────────────────────
app.route('/', stripeRoutes);    // POST /create-payment-intent, /webhook/stripe, /verify-deposit
app.route('/', coinbaseRoutes);  // POST /create-coinbase-charge, GET /coinbase-charge-status, POST /webhook/coinbase

// ──────────────────────────────────────────────────────────────
// Economy routes — all security-sensitive logic is here
// ──────────────────────────────────────────────────────────────
app.route('/', packOpeningRoutes);      // POST /open-pack
app.route('/', upgraderRoutes);         // POST /upgrader/spin
app.route('/', exchangerRoutes);        // POST /exchanger/trade
app.route('/battles', battleRoutes);    // /battles/*

// ──────────────────────────────────────────────────────────────
// Daily Packs Opened — deterministic time-based counter
// Resets at midnight Pacific, grows smoothly to 40k–80k by end of day.
// ──────────────────────────────────────────────────────────────
function hashDateToTarget(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return 40000 + (Math.abs(hash) % 40001); // 40,000 – 80,000
}

function getDailyPacksOpened(): number {
  const pacificNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const startOfDay = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate());
  const elapsedMs = pacificNow.getTime() - startOfDay.getTime();
  const totalMsInDay = 86400000;

  const dateSeed = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`;
  const target = hashDateToTarget(dateSeed);

  // Sigmoid curve: slow start, accelerates through midday, slows at end
  let t = Math.min(elapsedMs / totalMsInDay, 1);
  if (t < 0.5) {
    t = 4 * t * t * t;               // ease-in cubic
  } else {
    t = 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-out cubic
  }

  return Math.floor(target * t);
}

// ──────────────────────────────────────────────────────────────

// Explicitly mount stats to ensure it works
app.get('/battles/stats', async (c) => {
  const blink = getBlinkServer(c.env as any);

  try {
    const activeBattles = await blink.db.battles.list({
      where: {
        status: { in: ['waiting', 'live'] },
        isPublic: 1
      },
      limit: 100
    });

    const liveBattlesCount = activeBattles?.length || 0;
    const packsOpened = getDailyPacksOpened();

    return c.json({
      success: true,
      liveBattles: liveBattlesCount,
      packsOpened,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[battles/stats] error:', err.message);
    return c.json({ error: 'Failed to fetch battle stats' }, 500);
  }
});

app.route('/', cashoutRoutes);          // POST /cashout/submit
app.route('/', cashoutAdminRoutes);      // POST /admin/cashout/partial-fulfill, /admin/cashout/send-email
app.route('/', inventoryRoutes);        // POST /inventory/lock, /inventory/favorite, /sell, /sell-all
app.route('/', upgraderSettingsRoutes); // GET /upgrader/settings, POST /admin/upgrader/settings
app.route('/', sendTestEmailsRoutes);   // POST /send-test-emails (admin)
app.route('/', logsRoutes);             // GET /admin/logs, POST /admin/logs/action
app.route('/', provablyFairRoutes);     // GET /provably-fair/seed-hash, POST /admin/provably-fair/*

// ──────────────────────────────────────────────────────────────
// Referrals
// ──────────────────────────────────────────────────────────────
app.get('/referrals', async (c) => {
  const blink = getBlinkServer(c.env as any);
  const authHeader = c.req.header('Authorization');
  const auth = await blink.auth.verifyToken(authHeader);
  if (!auth.valid || !auth.userId) return c.json({ error: 'Unauthorized' }, 401);

  const userId = auth.userId;
  const page   = parseInt(c.req.query('page') || '1');
  const limit  = 10;
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
          // Check if any deposit exists at all
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
        createdAt: u.createdAt 
      };
    }));

    return c.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
