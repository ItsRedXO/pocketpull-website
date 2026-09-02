import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();
const camelToSnake = (v: string) => v.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const snakeToCamel = (v: string) => v.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const mapRow = (row: any) => {
  const out: any = {};
  for (const [key, value] of Object.entries(row)) out[snakeToCamel(key)] = value;
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) Object.assign(out, row.data);
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
  if (!admin && userId) {
    try {
      const user = await blink.db.users.get(userId) as any;
      admin = user?.role === 'admin' || user?.role === 'owner' || Number(user?.is_admin || 0) > 0;
    } catch {}
  }
  return { userId, admin };
}

app.post('/db', async (c, next) => {
  if (c.req.header('X-DB-Table') !== 'supportChats' && c.req.header('X-DB-Table') !== 'supportMessages') return next();
  const body = await c.req.json<any>();
  if (body.table !== 'supportChats' && body.table !== 'supportMessages') return next();
  try {
    const { userId, admin } = await identity(c);
    if (!userId && !admin) return c.json({ error: 'UNAUTHORIZED' }, 401);
    const logical = body.table;
    const table = logical === 'supportChats' ? 'support_chats' : 'support_messages';

    if (body.operation === 'get') {
      const rows = await query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`, [body.id]);
      const row = rows[0];
      if (!row) return c.json({ data: null });
      if (!admin) {
        const owner = logical === 'supportChats' ? row.user_id : (await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1', [row.chat_id]))[0]?.user_id;
        if (owner !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
      }
      return c.json({ data: mapRow(row) });
    }

    if (body.operation === 'list') {
      const where = { ...(body.where || {}) };
      if (!admin) {
        if (logical === 'supportChats') where.userId = userId;
        if (logical === 'supportMessages') {
          if (!where.chatId) return c.json({ error: 'FORBIDDEN' }, 403);
          const owner = await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1', [where.chatId]);
          if (owner[0]?.user_id !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
        }
      }
      const params: any[] = [];
      const clauses = Object.entries(where).map(([key, value]) => { params.push(value); return `${camelToSnake(key)}=$${params.length}`; });
      const orderEntries = Object.entries(body.orderBy || {});
      const order = orderEntries.length ? ` ORDER BY ${orderEntries.map(([key, dir]) => `${camelToSnake(key)} ${String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`).join(', ')}` : '';
      params.push(Math.min(Math.max(Number(body.limit) || 200, 1), 500));
      const rows = await query(`SELECT * FROM ${table}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}${order} LIMIT $${params.length}`, params);
      return c.json({ data: rows.map(mapRow) });
    }

    if (body.operation === 'create') {
      const data = { ...(body.data || {}) };
      if (!admin) {
        if (logical === 'supportChats' && data.userId !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
        if (logical === 'supportMessages' && (data.userId !== userId || data.senderType !== 'user')) return c.json({ error: 'FORBIDDEN' }, 403);
      }
      const columns = Object.keys(data).map(camelToSnake);
      const values = Object.values(data).map((value) => value && typeof value === 'object' ? JSON.stringify(value) : value);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
      const rows = await query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`, values);
      return c.json({ data: mapRow(rows[0]) });
    }

    if (body.operation === 'update' || body.operation === 'delete') {
      const rows = await query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`, [body.id]);
      const row = rows[0];
      if (!row) return c.json({ data: null });
      if (!admin) {
        const owner = logical === 'supportChats' ? row.user_id : (await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1', [row.chat_id]))[0]?.user_id;
        if (owner !== userId) return c.json({ error: 'FORBIDDEN' }, 403);
      }
      if (body.operation === 'delete') {
        await query(`DELETE FROM ${table} WHERE id=$1`, [body.id]);
        return c.json({ data: null });
      }
      const data = body.data || {};
      const keys = Object.keys(data).filter((key) => key !== 'id');
      if (!keys.length) return c.json({ data: mapRow(row) });
      const values = keys.map((key) => data[key] && typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
      const sets = keys.map((key, i) => `${camelToSnake(key)}=$${i + 1}`);
      values.push(body.id);
      const updated = await query(`UPDATE ${table} SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`, values);
      return c.json({ data: mapRow(updated[0]) });
    }

    return c.json({ error: 'Unsupported database operation' }, 400);
  } catch (error: any) {
    return c.json({ error: error?.message || 'Support database request failed' }, 500);
  }
});

export default app;
