import { Hono } from 'hono';
import { uid } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();

function mapLog(row: any) {
  return { id: row.id, userId: row.user_id, type: row.type, username: row.username, action: row.action, details: row.details || {}, valueIn: Number(row.value_in || 0), valueOut: Number(row.value_out || 0), result: row.result, metadata: row.metadata || {}, createdAt: row.created_at };
}

app.get('/admin/logs', async (c) => {
  try {
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
    if (search) { params.push(`%${search}%`); const p = `$${params.length}`; where.push(`(COALESCE(username,'') ILIKE ${p} OR COALESCE(action,'') ILIKE ${p} OR details::text ILIKE ${p})`); }
    if (dateFrom) add('created_at >= ?', new Date(dateFrom));
    if (dateTo) add('created_at <= ?', new Date(`${dateTo}T23:59:59.999`));
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM activity_logs ${clause}`, params);
    const total = Number(countRows[0]?.count || 0);
    const rows = await query(`SELECT * FROM activity_logs ${clause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    return c.json({ logs: rows.map(mapLog), total, page, totalPages: Math.ceil(total / limit), limit });
  } catch (err: any) { return c.json({ error: err?.message || 'Internal server error' }, 500); }
});

app.get('/admin-logs', async (c) => {
  try {
    const userId = (c.req.query('userId') || '').trim();
    const type = (c.req.query('type') || '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0') || 0);
    const where: string[] = [];
    const params: any[] = [];
    if (userId) { params.push(userId); where.push(`user_id = $${params.length}`); }
    if (type) { params.push(type); where.push(`type = $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM activity_logs ${clause}`, params);
    const rows = await query(`SELECT * FROM activity_logs ${clause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    return c.json({ success: true, rows: rows.map(mapLog), total: Number(countRows[0]?.count || 0) });
  } catch (err: any) { return c.json({ error: err?.message || 'Internal server error' }, 500); }
});

app.post('/admin/logs/action', async (c) => {
  try {
    const body = await c.req.json();
    await writeLog(null, { type: 'admin', userId: null, username: body.adminUsername || 'Admin', action: body.action || 'Admin Action', details: { targetUser: body.targetUser, ...(body.details || {}) }, valueIn: 0, valueOut: 0, result: 'admin_action', metadata: body.metadata });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err?.message || 'Internal server error' }, 500); }
});

export default app;

export interface LogEntry { type: string; userId: string | null; username: string; action: string; details: Record<string, any>; valueIn?: number; valueOut?: number; result?: string; metadata?: Record<string, any>; }

export async function writeLog(_blink: any, entry: LogEntry): Promise<void> {
  try {
    await query(`INSERT INTO activity_logs(id,user_id,type,username,action,details,value_in,value_out,result,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [`log_${uid()}`, entry.userId || null, entry.type, entry.username || 'Unknown', entry.action, JSON.stringify(entry.details || {}), entry.valueIn || 0, entry.valueOut || 0, entry.result || null, JSON.stringify(entry.metadata || {})]);
  } catch (err: any) { console.error('[writeLog] Failed to write log:', err?.message || err); }
}
