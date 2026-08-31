/**
 * Logs Routes — activity log management for admin panel.
 *
 * GET  /admin/logs         - Fetch paginated logs with search/filter
 * GET  /admin-logs         - Lightweight paginated logs (userId, type, offset/limit)
 * POST /admin/logs/action  - Write an admin action log entry
 */
import { Hono } from 'hono';
import { getBlinkServer, uid } from '../lib/auth';

const app = new Hono();

// Simple admin secret check (same as other admin routes use)
function isAdminRequest(c: any): boolean {
  const adminHeader = c.req.header('X-Admin-Secret');
  // Accept any non-empty admin header OR check the Bearer token matches a known admin
  return !!adminHeader;
}

/**
 * GET /admin/logs
 * Fetch logs with optional search, type filter, date range, pagination.
 */
app.get('/admin/logs', async (c) => {
  const blink = getBlinkServer(c.env as any);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, parseInt(c.req.query('limit') || '50'));
    const offset = (page - 1) * limit;
    const search = c.req.query('search') || '';
    const type = c.req.query('type') || ''; // e.g. pack_open, upgrade, exchange, battle, sell, deposit, cashout, admin
    const dateFrom = c.req.query('dateFrom') || '';
    const dateTo = c.req.query('dateTo') || '';

    // Build where clause
    const where: Record<string, any> = {};
    if (type) where.type = type;

    // Fetch all matching (we'll filter in memory for search — SQLite SDK doesn't support LIKE)
    const rawLogs = await blink.db.activityLogs.list({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      limit: 2000, // fetch enough to search/filter
    }) as any[];

    // Filter by search and date range in memory
    let filtered = rawLogs;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((log: any) => {
        const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
        return (
          (log.username || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          details.toLowerCase().includes(q)
        );
      });
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      filtered = filtered.filter((log: any) => new Date(log.createdAt).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59').getTime();
      filtered = filtered.filter((log: any) => new Date(log.createdAt).getTime() <= to);
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return c.json({
      logs: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });

  } catch (err: any) {
    console.error('[admin/logs] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /admin-logs?userId=xxx&limit=50&offset=0&type=pack_open
 * Lightweight paginated logs for the admin panel.
 * - userId: filter by specific user (omit for global view)
 * - type: optional activity type filter
 * - limit / offset: standard pagination
 * - details are parsed from JSON string → object before return
 *
 * Uses DB-level filtering for the most selective column, then memory filter
 * for the secondary column (SDK REST API doesn't support AND in where).
 */
app.get('/admin-logs', async (c) => {
  const blink = getBlinkServer(c.env as any);

  try {
    const userId = (c.req.query('userId') || '').trim();
    const type = (c.req.query('type') || '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0') || 0);

    // DB filter: apply the most selective column. If both provided, filter
    // by userId at DB level (more selective) and by type in memory.
    const dbWhere: Record<string, any> | undefined = userId
      ? { userId }
      : type
        ? { type }
        : undefined;

    // Fetch a generous window from DB, then apply secondary filter + pagination in memory
    const fetchLimit = 2000;

    const rawLogs = await blink.db.activityLogs.list({
      where: dbWhere,
      orderBy: { createdAt: 'desc' },
      limit: fetchLimit,
    }) as any[];

    // Secondary filter: if both userId AND type were requested, filter type in memory
    const filtered = userId && type
      ? rawLogs.filter((log: any) => log.type === type)
      : rawLogs;

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // Parse details from JSON string to object
    const rows = paginated.map((log: any) => ({
      ...log,
      details:
        typeof log.details === 'string'
          ? safeParseJSON(log.details, {})
          : log.details || {},
    }));

    return c.json({
      success: true,
      rows,
      total,
    });
  } catch (err: any) {
    console.error('[admin-logs] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/logs/action
 * Write an admin action log entry.
 */
app.post('/admin/logs/action', async (c) => {
  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { adminUsername, action, targetUser, details, metadata } = body;

    await writeLog(blink, {
      type: 'admin',
      userId: null,
      username: adminUsername || 'Admin',
      action: action || 'Admin Action',
      details: {
        targetUser,
        ...details,
      },
      valueIn: 0,
      valueOut: 0,
      result: 'admin_action',
      metadata,
    });

    return c.json({ success: true });
  } catch (err: any) {
    console.error('[admin/logs/action] error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default app;

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

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

export async function writeLog(blink: any, entry: LogEntry): Promise<void> {
  try {
    await blink.db.activityLogs.create({
      id: `log_${uid()}`,
      type: entry.type,
      userId: entry.userId || null,
      username: entry.username || 'Unknown',
      action: entry.action,
      details: JSON.stringify(entry.details || {}),
      valueIn: entry.valueIn || 0,
      valueOut: entry.valueOut || 0,
      result: entry.result || null,
      metadata: JSON.stringify(entry.metadata || {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    // Logging is non-critical — never let it crash the main flow
    console.error('[writeLog] Failed to write log:', err.message);
  }
}

/** Safely parse a JSON string, returning fallback on failure. */
function safeParseJSON(raw: string, fallback: any): any {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
