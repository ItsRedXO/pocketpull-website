import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();
const snake = (key: string) => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const mapRow = (row: any) => {
  const out: any = {};
  for (const [key, value] of Object.entries(row)) out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  return out;
};

async function identity(c: any) {
  const blink = getBlinkServer(c.env as any);
  let userId: string | null = null;
  let admin = false;
  try {
    const result = await blink.auth.verifyToken(c.req.header('Authorization'));
    if (result.valid && result.userId) userId = result.userId;
  } catch {}
  const secret = c.req.header('X-Admin-Secret');
  if (secret && secret !== 'true') {
    try {
      const rows = await blink.db.adminCredentials.list({});
      admin = rows.some((r: any) => (r.adminPass || r.admin_pass) === secret);
    } catch {}
  }
  return { userId, admin };
}

app.post('/db', async (c, next) => {
  if (c.req.header('X-DB-Table') !== 'users') return next();
  const identityResult = await identity(c);
  if (identityResult.admin) return next();
  const body = await c.req.json<any>();
  if (body.table !== 'users') return c.json({ error: 'Invalid database table' }, 400);
  try {
    const { userId } = identityResult;
    const where = body.where || {};

    if (body.operation === 'list') {
      const allowedField = ['username', 'email', 'referralCode'].find((field) => typeof where[field] === 'string');
      if (!allowedField) return next();
      if (!userId && allowedField === 'referralCode') return c.json({ data: [] });
      const field = snake(allowedField);
      const value = allowedField === 'email' ? where.email.trim().toLowerCase() : where[allowedField];
      // Unauthenticated lookup is intentionally limited to the fields needed by
      // signup/referral checks; never expose balances, email, roles, or profile data.
      const rows = await query(`SELECT id, username, is_banned, is_deleted FROM users WHERE ${field}=$1 LIMIT $2`, [value, Math.min(Math.max(Number(body.limit) || 5, 1), 5)]);
      return c.json({ data: rows.map(mapRow) });
    }

    if (!userId) return c.json({ error: 'UNAUTHORIZED' }, 401);

    if (body.operation === 'get') {
      if (body.id !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
      const rows = await query('SELECT * FROM users WHERE id=$1 LIMIT 1', [userId]);
      return c.json({ data: rows[0] ? mapRow(rows[0]) : null });
    }

    if (body.operation === 'create') {
      const data = { ...(body.data || {}) };
      if (data.id !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
      const keys = Object.keys(data);
      const columns = keys.map(snake);
      const values = Object.values(data).map((value) => value && typeof value === 'object' ? JSON.stringify(value) : value);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
      const rows = await query(`INSERT INTO users (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`, values);
      return c.json({ data: mapRow(rows[0]) });
    }

    if (body.operation === 'update') {
      if (body.id !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
      const data = body.data || {};
      const keys = Object.keys(data).filter((key) => !['id', 'balance', 'matchedBalance', 'isAdmin', 'role'].includes(key));
      if (!keys.length) return c.json({ data: null });
      const values = keys.map((key) => data[key] && typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
      const sets = keys.map((key, i) => `${snake(key)}=$${i + 1}`);
      values.push(userId);
      const rows = await query(`UPDATE users SET ${sets.join(',')}, updated_at=now() WHERE id=$${values.length} RETURNING *`, values);
      return c.json({ data: rows[0] ? mapRow(rows[0]) : null });
    }

    return c.json({ error: 'Unsupported user database operation' }, 400);
  } catch (error: any) {
    return c.json({ error: error?.message || 'User database request failed' }, 500);
  }
});

export default app;
