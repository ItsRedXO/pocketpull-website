import { Hono } from 'hono';
import { query } from '../lib/postgres';

const app = new Hono();

app.get('/auth/user-lookup', async (c) => {
  try {
    const username = c.req.query('username')?.trim();
    const email = c.req.query('email')?.trim().toLowerCase();
    if ((!username && !email) || (username && email)) return c.json({ error: 'Provide username or email' }, 400);
    const field = username ? 'username' : 'email';
    const value = username || email;
    const rows = await query(`SELECT id, username, is_banned, is_deleted FROM users WHERE ${field}=$1 LIMIT 5`, [value]);
    return c.json({ users: rows });
  } catch (error: any) {
    return c.json({ error: error?.message || 'User lookup failed' }, 500);
  }
});

export default app;
