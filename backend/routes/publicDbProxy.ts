import { Hono } from 'hono';
import { postgresBlinkDb } from '../lib/postgresBlinkDb';
import { query } from '../lib/postgres';

const app = new Hono();
const PUBLIC_TABLES = new Set(['packsCatalog', 'packCards', 'battles', 'battlePlayers', 'battleParticipants', 'battleResults', 'battlePullAudits', 'leaderboardStats']);
const BATTLE_CHILDREN = new Set(['battlePlayers', 'battleParticipants', 'battleResults', 'battlePullAudits']);

// Curated public read of recent real pulls, for the homepage's live ticker.
// Deliberately not a generic table-proxy entry for `inventory`/`users` --
// those tables carry fields (balances, emails, locked/favorite flags, raw
// jsonb data) that have no business being public. This returns only what
// the ticker actually shows.
app.get('/recent-pulls', async c => {
  const limitParam = Number(c.req.query('limit'));
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitParam) ? limitParam : 12));
  try {
    const rows = await query<{ id: string; card_name: string; rarity: string; card_image_url: string | null; created_at: string; username: string | null }>(
      `SELECT i.id, i.card_name, i.rarity, i.card_image_url, i.created_at, u.username
       FROM inventory i
       JOIN users u ON u.id = i.user_id
       WHERE COALESCE(u.is_deleted,0)=0 AND COALESCE(u.is_banned,0)=0
       ORDER BY i.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return c.json({
      pulls: rows.map(r => ({
        id: r.id,
        cardName: r.card_name,
        rarity: r.rarity,
        cardImageUrl: r.card_image_url,
        createdAt: r.created_at,
        user: r.username || 'Trainer',
      })),
    });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to load recent pulls' }, 500);
  }
});

app.post('/db', async (c, next) => {
  if (!PUBLIC_TABLES.has(c.req.header('X-DB-Table') || '')) return next();
  const body = await c.req.json<any>();
  if (!PUBLIC_TABLES.has(body.table) || !['get', 'list'].includes(body.operation)) return next();
  try {
    const table: any = postgresBlinkDb.table(body.table);
    if (body.table === 'battles') {
      if (body.operation === 'get') {
        const rows = await query('SELECT id FROM battles WHERE id=$1 AND is_public=1 LIMIT 1',[body.id]);
        return c.json({data: rows.length ? await table.get(body.id) : null});
      }
      const where = {...(body.where||{}), isPublic: 1};
      return c.json({data: await table.list({where,orderBy:body.orderBy,limit:body.limit,offset:body.offset})});
    }
    if (BATTLE_CHILDREN.has(body.table)) {
      if (body.operation === 'get') {
        const row = await table.get(body.id);
        if (!row) return c.json({data:null});
        const battleId = row.battleId || row.battle_id;
        const visible = await query('SELECT 1 FROM battles WHERE id=$1 AND is_public=1 LIMIT 1',[battleId]);
        return c.json({data: visible.length ? row : null});
      }
      const where = {...(body.where||{})};
      const battleId = where.battleId;
      if (!battleId) return c.json({data:[]});
      const visible = await query('SELECT 1 FROM battles WHERE id=$1 AND is_public=1 LIMIT 1',[battleId]);
      if (!visible.length) return c.json({data:[]});
      return c.json({data: await table.list({where,orderBy:body.orderBy,limit:body.limit,offset:body.offset})});
    }
    if (body.operation === 'get') return c.json({ data: await table.get(body.id) });
    return c.json({ data: await table.list({ where: body.where || {}, orderBy: body.orderBy, limit: body.limit, offset: body.offset }) });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Database request failed' }, 500);
  }
});

export default app;
