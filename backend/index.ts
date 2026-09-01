import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getBlinkServer } from './lib/auth';
import adminPacksRoutes from './routes/adminPacks';
import catalogRoutes from './routes/catalog';
import profileRoutes from './routes/profile';
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
app.get('/health', c => c.json({ status: 'ok', time: new Date().toISOString(), version: 'v4-postgresql' }));
app.route('/', catalogRoutes); app.route('/', profileRoutes); app.route('/', stripeRoutes); app.route('/', coinbaseRoutes); app.route('/', packOpeningRoutes); app.route('/', upgraderRoutes); app.route('/', exchangerRoutes); app.route('/battles', battleRoutes);
app.route('/', cashoutRoutes); app.route('/', cashoutAdminRoutes); app.route('/', inventoryRoutes); app.route('/', upgraderSettingsRoutes); app.route('/', sendTestEmailsRoutes); app.route('/', logsRoutes); app.route('/', provablyFairRoutes); app.route('/', adminPacksRoutes);

function hashDateToTarget(dateStr: string): number { let hash = 0; for (let i = 0; i < dateStr.length; i++) { hash = ((hash << 5) - hash) + dateStr.charCodeAt(i); hash |= 0; } return 40000 + (Math.abs(hash) % 40001); }
function getDailyPacksOpened(): number { const pacificNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })); const startOfDay = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate()); const elapsedMs = pacificNow.getTime() - startOfDay.getTime(); const dateSeed = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`; const target = hashDateToTarget(dateSeed); let t = Math.min(elapsedMs / 86400000, 1); t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; return Math.floor(target * t); }
app.get('/battles/stats', async c => { const blink = getBlinkServer(c.env as any); try { const activeBattles = await blink.db.battles.list({ where: { status: { in: ['waiting', 'live'] }, isPublic: 1 }, limit: 100 }); return c.json({ success: true, liveBattles: activeBattles?.length || 0, packsOpened: getDailyPacksOpened(), timestamp: new Date().toISOString() }); } catch { return c.json({ error: 'Failed to fetch battle stats' }, 500); } });
app.get('/referrals', async c => { const blink = getBlinkServer(c.env as any); const auth = await blink.auth.verifyToken(c.req.header('Authorization')); if (!auth.valid || !auth.userId) return c.json({ error: 'Unauthorized' }, 401); const page = parseInt(c.req.query('page') || '1'); const limit = 10; const offset = (page - 1) * limit; try { const referredUsers = await blink.db.users.list({ where: { referredById: auth.userId }, orderBy: { createdAt: 'desc' }, limit, offset }); const total = await blink.db.users.count({ where: { referredById: auth.userId } }); const data = await Promise.all((referredUsers as any[]).map(async u => { let status: 'Reward Paid' | 'Deposit Pending' | 'Signed Up' = 'Signed Up'; let deposited = false; if (u.referralRewardPaid || Number(u.referralRewardPaid) > 0) { status = 'Reward Paid'; deposited = true; } else { const qualifying = await blink.db.transactions.exists({ where: { userId: u.id, type: 'deposit', amount: { gte: 5 } } }); if (qualifying) { status = 'Deposit Pending'; deposited = true; } else deposited = await blink.db.transactions.exists({ where: { userId: u.id, type: 'deposit' } }); } return { id: u.id, username: u.username || u.displayName || 'Trainer', email: u.isDeleted ? 'Released' : (u.email || 'Hidden'), status, deposited, createdAt: u.createdAt }; })); return c.json({ data, total, page, totalPages: Math.ceil(total / limit) }); } catch (err: any) { return c.json({ error: err.message }, 500); } });
export default app;
