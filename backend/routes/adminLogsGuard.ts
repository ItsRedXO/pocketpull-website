import type { MiddlewareHandler } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';

export const adminLogsGuard: MiddlewareHandler = async (c, next) => {
  try {
    const secret = c.req.header('X-Admin-Secret');
    if (isAdminSecretCandidate(secret)) {
      const rows = await query('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
      if (rows[0]) return next();
    }
    const authorization = c.req.header('Authorization');
    if (!authorization?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const auth = await getBlinkServer(c.env as any).auth.verifyToken(authorization);
    if (!auth.valid || !auth.userId) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [auth.userId]);
    const user = rows[0];
    if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) return c.json({ error: 'Forbidden' }, 403);
    return next();
  } catch (error: any) {
    console.error('[adminLogsGuard]', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
};
