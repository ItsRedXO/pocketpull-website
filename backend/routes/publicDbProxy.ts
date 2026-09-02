import { Hono } from 'hono';
import { postgresBlinkDb } from '../lib/postgresBlinkDb';

const app = new Hono();
const PUBLIC_TABLES = new Set(['packsCatalog', 'packCards', 'battles', 'battlePlayers', 'battleParticipants', 'battleResults', 'battlePullAudits', 'leaderboardStats']);

app.post('/db', async (c, next) => {
  if (!PUBLIC_TABLES.has(c.req.header('X-DB-Table') || '')) return next();
  const body = await c.req.json<any>();
  if (!PUBLIC_TABLES.has(body.table) || !['get', 'list'].includes(body.operation)) return next();
  try {
    const table: any = postgresBlinkDb.table(body.table);
    if (body.operation === 'get') return c.json({ data: await table.get(body.id) });
    return c.json({ data: await table.list({ where: body.where || {}, orderBy: body.orderBy, limit: body.limit, offset: body.offset }) });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Database request failed' }, 500);
  }
});

export default app;
