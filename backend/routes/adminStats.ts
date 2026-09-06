import { Hono } from 'hono';
import { resolveUserId } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';

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

app.get('/admin/stats', async c => {
  try {
    await requireAdmin(c);
    const [users, pulls, revenue, balance, packs] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users WHERE COALESCE(is_deleted,0)=0 AND COALESCE(is_bot,0)=0'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM packs_opened'),
      query<{ total: string }>(`SELECT COALESCE(SUM(amount),0)::text AS total FROM transactions WHERE LOWER(COALESCE(type,''))='deposit'`),
      query<{ total: string }>('SELECT COALESCE(SUM(balance),0)::text AS total FROM users WHERE COALESCE(is_deleted,0)=0 AND COALESCE(is_bot,0)=0'),
      query(`SELECT p.id,p.name,p.price,p.is_active,COUNT(po.id)::text AS opens FROM packs_catalog p LEFT JOIN packs_opened po ON po.pack_id=p.id GROUP BY p.id,p.name,p.price,p.is_active ORDER BY opens DESC`),
    ]);
    const packBreakdown = packs.map((row: any) => ({ id: row.id, name: row.name, price: Number(row.price || 0), opens: Number(row.opens || 0), active: Number(row.is_active || 0) > 0 }));
    return c.json({
      totalUsers: Number(users[0]?.count || 0),
      totalPulls: Number(pulls[0]?.count || 0),
      totalRevenue: Number(revenue[0]?.total || 0),
      totalBalance: Number(balance[0]?.total || 0),
      activePacks: packBreakdown.filter(p => p.active).length,
      totalPacks: packBreakdown.length,
      packBreakdown,
    });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Failed to load admin stats' }, status);
  }
});

export default app;
