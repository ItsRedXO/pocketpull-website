import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { uid } from '../lib/auth';

const app = new Hono();

async function requireAdmin(c: any): Promise<void> {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return;
  }

  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');

  const blink = getBlinkServer(c.env as any);
  const auth = await blink.auth.verifyToken(authorization);
  if (!auth.valid || !auth.userId) throw new Error('UNAUTHORIZED');

  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [auth.userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) {
    throw new Error('FORBIDDEN');
  }
}

function mapLog(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    username: row.username,
    action: row.action,
    details: row.details || {},
    valueIn: Number(row.value_in || 0),
    valueOut: Number(row.value_out || 0),
    result: row.result,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

app.get('/admin/logs', async c => {
  try {
    await requireAdmin(c);
    const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50') || 50));
    const offset = (page - 1) * limit;
    const search = (c.req.query('search') || '').trim();
    const type = (c.req.query('type') || '').trim();
    const dateFrom = c.req.query('dateFrom') || '';
    const dateTo = c.req.query('dateTo') || '';

    const where: string[] = [];
    const params: any[] = [];
    const add = (sql: string, value: any) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (type) add('type = ?', type);
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      where.push(`(COALESCE(username,'') ILIKE ${p} OR COALESCE(action,'') ILIKE ${p} OR details::text ILIKE ${p})`);
    }
    if (dateFrom) add('created_at >= ?', new Date(dateFrom));
    if (dateTo) add('created_at <= ?', new Date(`${dateTo}T23:59:59.999`));
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM activity_logs ${clause}`, params);
    const total = Number(countRows[0]?.count || 0);
    const rows = await query(
      `SELECT * FROM activity_logs ${clause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return c.json({ logs: rows.map(mapLog), total, page, totalPages: Math.ceil(total / limit), limit });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Failed to load admin logs' }, status);
  }
});

app.post('/admin/logs/action', async c => {
  try {
    await requireAdmin(c);
    const body = await c.req.json().catch(() => ({}));
    await query(
      `INSERT INTO activity_logs(id,user_id,type,username,action,details,value_in,value_out,result,metadata)
       VALUES($1,NULL,'admin',$2,$3,$4,0,0,'admin_action',$5)`,
      [
        `log_${uid()}`,
        String(body.adminUsername || 'Admin'),
        String(body.action || 'Admin Action'),
        JSON.stringify({ targetUser: body.targetUser, ...(body.details || {}) }),
        JSON.stringify(body.metadata || {}),
      ],
    );
    return c.json({ success: true });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Failed to write admin log' }, status);
  }
});

export default app;
