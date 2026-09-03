import { Hono } from 'hono';
import { query } from '../lib/postgres';

const app = new Hono();

app.post('/admin/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ identifier?: string; password?: string }>();
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!identifier || !password) return c.json({ success: false, error: 'Invalid username or password.' }, 401);

    const rows = await query<{ admin_pass: string; data: any }>('SELECT admin_pass, data FROM admin_credentials LIMIT 10');
    const match = rows.find((row) => {
      const data = row.data && typeof row.data === 'object' ? row.data : {};
      return String(data.username || '').toLowerCase() === identifier || String(data.email || '').toLowerCase() === identifier;
    });
    if (!match || match.admin_pass !== password) return c.json({ success: false, error: 'Invalid username or password.' }, 401);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error?.message || 'Admin login failed' }, 500);
  }
});

export default app;
