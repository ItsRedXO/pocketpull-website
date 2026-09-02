import { Hono } from 'hono';
import { query } from '../lib/postgres';

const app = new Hono();
const mapRow = (row: any) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  displayName: row.display_name,
  isBanned: row.is_banned,
  isDeleted: row.is_deleted,
});

app.post('/db', async (c, next) => {
  const body = await c.req.json<any>();
  if (body.table !== 'users' || body.operation !== 'list') return next();
  const where = body.where || {};
  const field = typeof where.username === 'string' ? 'username' : typeof where.email === 'string' ? 'email' : null;
  if (!field) return next();
  const value = field === 'email' ? where.email.trim().toLowerCase() : where.username;
  const rows = await query(`SELECT id, email, username, display_name, is_banned, is_deleted FROM users WHERE ${field}=$1 LIMIT $2`, [value, Math.min(Math.max(Number(body.limit) || 5, 1), 5)]);
  return c.json({ data: rows.map(mapRow) });
});

export default app;
