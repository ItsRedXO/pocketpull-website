import { Hono } from 'hono';
import { requireAuth, uid } from '../lib/auth';
import { createActivityLog, listActivityLogs } from '../db/repositories/activityLogs';

const app = new Hono();

export interface LogEntry {
  type: string;
  userId: string | null;
  username: string;
  action: string;
  details: Record<string, any>;
  valueIn?: number;
  valueOut?: number;
  result?: string;
  metadata?: Record<string, any>;
}

export async function writeLog(_provider: any, entry: LogEntry): Promise<void> {
  try {
    const env = (_provider?.env || _provider) as any;
    await createActivityLog(env, {
      id: `log_${uid()}`,
      ...entry,
      valueIn: entry.valueIn || 0,
      valueOut: entry.valueOut || 0,
    });
  } catch (err: any) {
    console.error('[writeLog] Failed to write PostgreSQL log:', err?.message || err);
  }
}

async function adminUserId(c: any): Promise<string> {
  const userId = await requireAuth(c);
  const { getUserProfile } = await import('../db/repositories/users');
  const user = await getUserProfile(c.env as any, userId);
  if (!user || !['admin', 'owner'].includes(user.role)) throw new Error('ADMIN_REQUIRED');
  return userId;
}

app.get('/admin/logs', async (c) => {
  try {
    await adminUserId(c);
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)));
    const result = await listActivityLogs(c.env as any, {
      search: c.req.query('search') || undefined,
      type: c.req.query('type') || undefined,
      dateFrom: c.req.query('dateFrom') || undefined,
      dateTo: c.req.query('dateTo') || undefined,
      limit,
      offset: (page - 1) * limit,
    });
    return c.json({ logs: result.rows, total: result.total, page, totalPages: Math.ceil(result.total / limit), limit });
  } catch (err: any) {
    const status = err?.message === 'ADMIN_REQUIRED' ? 403 : err?.message?.includes('UNAUTHORIZED') ? 401 : 500;
    return c.json({ error: err?.message || 'Internal server error' }, status as any);
  }
});

app.get('/admin-logs', async (c) => {
  try {
    await adminUserId(c);
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 50)));
    const offset = Math.max(0, Number(c.req.query('offset') || 0));
    const result = await listActivityLogs(c.env as any, {
      userId: c.req.query('userId') || undefined,
      type: c.req.query('type') || undefined,
      limit,
      offset,
    });
    return c.json({ success: true, rows: result.rows, total: result.total });
  } catch (err: any) {
    const status = err?.message === 'ADMIN_REQUIRED' ? 403 : 401;
    return c.json({ error: err?.message || 'Unauthorized' }, status as any);
  }
});

app.post('/admin/logs/action', async (c) => {
  try {
    const adminId = await adminUserId(c);
    const { getUserProfile } = await import('../db/repositories/users');
    const admin = await getUserProfile(c.env as any, adminId);
    const body = await c.req.json();
    await createActivityLog(c.env as any, {
      id: `log_${uid()}`,
      type: 'admin',
      userId: adminId,
      username: admin?.username || admin?.displayName || 'Admin',
      action: body.action || 'Admin Action',
      details: { targetUser: body.targetUser, ...(body.details || {}) },
      valueIn: 0,
      valueOut: 0,
      result: 'admin_action',
      metadata: body.metadata || {},
    });
    return c.json({ success: true });
  } catch (err: any) {
    const status = err?.message === 'ADMIN_REQUIRED' ? 403 : 401;
    return c.json({ error: err?.message || 'Unauthorized' }, status as any);
  }
});

export default app;
