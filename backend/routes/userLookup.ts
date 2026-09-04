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

    if (username) {
      const rows = await query(
        `SELECT id, username, email, is_banned, is_deleted
         FROM users
         WHERE lower(trim(username)) = lower(trim($1))
            OR lower(trim(display_name)) = lower(trim($1))
         ORDER BY CASE WHEN lower(trim(username)) = lower(trim($1)) THEN 0 ELSE 1 END
         LIMIT 5`,
        [username],
      );
      return c.json({ users: rows });
    }

    if (email) {
      const rows = await query(
        `SELECT id, username, email, is_banned, is_deleted
         FROM users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 5`,
        [email],
      );
      return c.json({ users: rows });
    }

    const rows = await query(
      `SELECT id, username, email, is_banned, is_deleted
       FROM users WHERE lower(trim(display_name)) = lower(trim($1)) LIMIT 5`,
      [displayName],
    );
    return c.json({ users: rows });
  } catch (error: any) {
    return c.json({ error: error?.message || 'User lookup failed' }, 500);
  }
});

export default app;
