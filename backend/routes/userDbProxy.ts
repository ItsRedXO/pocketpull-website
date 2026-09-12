import { Hono } from 'hono';
import { getBlinkDb, resolveUserId } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';

const app = new Hono();
const snake = (key: string) => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const mapRow = (row: any) => {
  const out: any = {};
  for (const [key, value] of Object.entries(row)) out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  return out;
};

async function identity(c: any) {
  const blink = getBlinkDb();
  const userId = await resolveUserId(c);
  let admin = false;
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    try {
      const rows = await blink.db.adminCredentials.list({});
      admin = rows.some((r: any) => (r.adminPass || r.admin_pass) === secret);
    } catch {}
  }
  // Was missing this fallback -- an admin session that authenticates via its
  // own account (role/is_admin on the users row) rather than the
  // X-Admin-Secret header always resolved admin=false here, so this route's
  // own "you can only touch your own row" restrictions applied to a real
  // admin viewing anyone else's profile, throwing FORBIDDEN on get()/update()
  // for every user but the admin's own account. dbProxy.ts (the general /db
  // handler this route sits in front of) already checks both; this now does
  // too, matching it.
  if (!admin && userId) {
    try {
      const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
      const user = rows[0];
      admin = user?.role === 'admin' || user?.role === 'owner' || Number(user?.is_admin || 0) > 0;
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
