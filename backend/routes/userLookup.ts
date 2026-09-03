import { Hono } from 'hono';
import { query } from '../lib/postgres';

const app = new Hono();

app.get('/auth/user-lookup', async (c) => {
  try {
    const username = c.req.query('username')?.trim();
    const email = c.req.query('email')?.trim().toLowerCase();
    const displayName = c.req.query('displayName')?.trim();
    const provided = [username, email, displayName].filter(Boolean);
    if (provided.length !== 1) return c.json({ error: 'Provide username, email, or displayName' }, 400);

    const field = username ? 'username' : email ? 'email' : 'display_name';
    const value = username || email || displayName;
    const columns = username ? 'id, username, email, is_banned, is_deleted' : 'id, username, is_banned, is_deleted';
    const rows = await query(`SELECT ${columns} FROM users WHERE ${field}=$1 LIMIT 5`, [value]);
    return c.json({ users: rows });
  } catch (error: any) {
    return c.json({ error: error?.message || 'User lookup failed' }, 500);
  }
});

export default app;
