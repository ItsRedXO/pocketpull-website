import { Hono } from 'hono';
import { resolveUserId } from '../lib/auth';
import { query } from '../lib/postgres';
import { postgresBlinkDb } from '../lib/postgresBlinkDb';
import { buildSupportMessageScope } from '../supportMessageScope';

const app = new Hono();

const TABLES: Record<string, string> = {
  users: 'users', packsCatalog: 'packs_catalog', packCards: 'pack_cards', packCooldowns: 'pack_cooldowns',
  inventory: 'inventory', transactions: 'transactions', packsOpened: 'packs_opened', serverSeeds: 'server_seeds',
  packOddsVersions: 'pack_odds_versions', userNonces: 'user_nonces', battles: 'battles', battlePlayers: 'battle_players',
  battleParticipants: 'battle_participants', battleResults: 'battle_results', battlePullAudits: 'battle_pull_audits',
  upgraderSettings: 'upgrader_settings', upgraderMultiplierSettings: 'upgrader_multiplier_settings', upgraderSpins: 'upgrader_spins',
  upgraderHistory: 'upgrader_history', exchangerActivity: 'exchanger_activity', cashouts: 'cashouts', cashoutRequests: 'cashout_requests',
  activityLogs: 'activity_logs', outboundEmails: 'outbound_emails', walletTransactions: 'wallet_transactions', leaderboardStats: 'leaderboard_stats',
  adminCredentials: 'admin_credentials', supportChats: 'support_chats', supportMessages: 'support_messages',
};

const USER_SCOPED = new Set([
  'inventory', 'transactions', 'packsOpened', 'packCooldowns', 'userNonces', 'upgraderSpins', 'upgraderHistory',
  'exchangerActivity', 'cashouts', 'cashoutRequests', 'activityLogs', 'walletTransactions',
]);
const READ_ONLY_FOR_USERS = new Set(['users', 'serverSeeds', 'packOddsVersions', 'upgraderSettings', 'upgraderMultiplierSettings']);
const WRITE_BLOCKED_FOR_USERS = new Set([
  'users', 'packsCatalog', 'packCards', 'serverSeeds', 'packOddsVersions', 'battles', 'battlePlayers', 'battleParticipants',
  'battleResults', 'battlePullAudits', 'upgraderSettings', 'upgraderMultiplierSettings', 'upgraderSpins', 'upgraderHistory',
  'exchangerActivity', 'cashouts', 'cashoutRequests', 'activityLogs', 'outboundEmails', 'walletTransactions', 'leaderboardStats',
  'adminCredentials',
]);

const camelToSnake = (value: string) => value.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const snakeToCamel = (value: string) => value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const jsonColumns = new Set(['data', 'details', 'metadata', 'snapshot', 'odds_json', 'cards_json', 'won_cards_json', 'removed_card_ids_json', 'packs_json', 'fulfilled_card_ids']);
const mapRow = (row: any) => {
  const out: any = {};
  for (const [key, value] of Object.entries(row)) out[snakeToCamel(key)] = value;
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) Object.assign(out, row.data);
  return out;
};

async function auth(c: any): Promise<{ userId: string | null; admin: boolean }> {
  const userId = await resolveUserId(c);
  let admin = false;
  const secret = c.req.header('X-Admin-Secret');
  if (secret && secret !== 'true') {
    try {
      const rows = await query<{ admin_pass: string }>('SELECT admin_pass FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
      admin = rows.length > 0;
    } catch {}
  }
  if (!admin && userId) {
    try {
      const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
      const user = rows[0];
      admin = user?.role === 'admin' || user?.role === 'owner' || Number(user?.is_admin || 0) > 0;
    } catch {}
  }
  return { userId, admin };
}

function requireScope(logical: string, operation: string, userId: string | null, admin: boolean, options: any = {}) {
  if (!TABLES[logical]) throw new Error('Unknown database table');
  if (!admin && !userId) throw new Error('UNAUTHORIZED');
  if (admin) return;
  if (logical === 'adminCredentials') throw new Error('FORBIDDEN');
  if (operation === 'upsert' && !USER_SCOPED.has(logical)) throw new Error('FORBIDDEN');
  if (operation !== 'list' && operation !== 'get' && operation !== 'create' && operation !== 'count' && operation !== 'upsert') {
    if (WRITE_BLOCKED_FOR_USERS.has(logical)) throw new Error('FORBIDDEN');
  }
  if ((operation === 'create' || operation === 'upsert') && WRITE_BLOCKED_FOR_USERS.has(logical)) throw new Error('FORBIDDEN');
  if (logical === 'supportMessages' && operation === 'create') {
    if (options.data?.userId !== userId || options.data?.senderType !== 'user') throw new Error('FORBIDDEN');
  }
  if (logical === 'supportChats' && operation === 'create' && options.data?.userId !== userId) throw new Error('FORBIDDEN');
  if (USER_SCOPED.has(logical)) {
    const where = options.where || {};
    if (operation === 'list' && where.userId !== userId) throw new Error('FORBIDDEN');
    if (operation === 'count' && where.userId !== userId) throw new Error('FORBIDDEN');
    if (operation === 'get' && options.id) return;
    if ((operation === 'create' || operation === 'upsert') && options.data?.userId !== userId) throw new Error('FORBIDDEN');
  }
  if (logical === 'users' && ['list', 'count'].includes(operation) && options.where?.id !== userId) throw new Error('FORBIDDEN');
  if (READ_ONLY_FOR_USERS.has(logical) && operation === 'list' && logical === 'users' && options.where?.id !== userId) throw new Error('FORBIDDEN');
  if (logical === 'supportChats' && operation === 'list' && options.where?.userId !== userId) throw new Error('FORBIDDEN');
  if (logical === 'supportChats' && operation === 'count' && options.where?.userId !== userId) throw new Error('FORBIDDEN');
}

async function verifyOwnership(logical: string, row: any, userId: string | null, admin: boolean) {
  if (admin || !row || !userId) return;
  if (USER_SCOPED.has(logical) && row.userId !== userId) throw new Error('FORBIDDEN');
  if (logical === 'users' && row.id !== userId) throw new Error('FORBIDDEN');
  if (logical === 'supportChats' && row.userId !== userId) throw new Error('FORBIDDEN');
  if (logical === 'supportMessages') {
    const chats = await query<{ user_id: string }>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1', [row.chat_id || row.chatId]);
    if (!chats[0] || chats[0].user_id !== userId) throw new Error('FORBIDDEN');
  }
}

async function supportQuery(logical: string, operation: string, options: any, userId: string | null, admin: boolean) {
  const table = TABLES[logical];
  if (operation === 'get') {
    const rows = await query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`, [options.id]);
    if (!rows[0]) return null;
    await verifyOwnership(logical, rows[0], userId, admin);
    return mapRow(rows[0]);
  }
  if (operation === 'list' || operation === 'count') {
    const where = { ...(options.where || {}) };
    const params: any[] = [];
    const clauses: string[] = [];

    if (!admin && logical === 'supportChats') {
      const scope = { clause: 'user_id=$1', params: [userId as string] };
      clauses.push(scope.clause);
      params.push(...scope.params);
    }
    if (!admin && logical === 'supportMessages') {
      const scope = buildSupportMessageScope(userId as string);
      clauses.push(scope.clause);
      params.push(...scope.params);
    }

    for (const [key, value] of Object.entries(where)) {
      const column = camelToSnake(key);
      if (value && typeof value === 'object' && Array.isArray((value as any).in)) {
        const values = (value as any).in;
        if (!values.length) { clauses.push('FALSE'); continue; }
        const placeholders = values.map((v: any) => { params.push(v); return `$${params.length}`; });
        clauses.push(`${column} IN (${placeholders.join(',')})`);
      } else {
        params.push(value);
        clauses.push(`${column}=$${params.length}`);
      }
    }
    const clause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    if (operation === 'count') {
      const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}${clause}`, params);
      return Number(rows[0]?.count || 0);
    }
    const order = options.orderBy ? Object.entries(options.orderBy).map(([key, dir]) => `${camelToSnake(key)} ${String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`).join(', ') : '';
    const limit = Number(options.limit) > 0 ? Math.min(Number(options.limit), 500) : 200;
    params.push(limit);
    let sql = `SELECT * FROM ${table}${clause}${order ? ` ORDER BY ${order}` : ''} LIMIT $${params.length}`;
    if (options.offset !== undefined) { params.push(Math.max(0, Number(options.offset) || 0)); sql += ` OFFSET $${params.length}`; }
    const rows = await query(sql, params);
    return rows.map(mapRow);
  }
  return null;
}

app.post('/db', async (c) => {
  try {
    const body = await c.req.json<any>();
    const logical = body.table as string;
    const operation = body.operation as string;
    const { userId, admin } = await auth(c);
    requireScope(logical, operation, userId, admin, body);

    if ((logical === 'supportChats' || logical === 'supportMessages') && ['get', 'list', 'count'].includes(operation)) {
      return c.json({ data: await supportQuery(logical, operation, body, userId, admin) });
    }

    const table: any = postgresBlinkDb.table(logical);
    if (operation === 'get') {
      const row = await table.get(body.id);
      await verifyOwnership(logical, row, userId, admin);
      return c.json({ data: row });
    }
    if (operation === 'list') {
      if (!admin && USER_SCOPED.has(logical)) body.where = { ...(body.where || {}), userId };
      if (!admin && logical === 'users') body.where = { ...(body.where || {}), id: userId };
      return c.json({ data: await table.list({ where: body.where || {}, orderBy: body.orderBy, limit: body.limit, offset: body.offset }) });
    }
    if (operation === 'count') {
      const where = body.where || {};
      const params: any[] = [];
      const clauses = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${camelToSnake(key)}=$${params.length}`;
      });
      const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${TABLES[logical]}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`, params);
      return c.json({ data: Number(rows[0]?.count || 0) });
    }
    if (operation === 'create') {
      if (logical === 'supportChats' || logical === 'supportMessages') {
        const data = { ...(body.data || {}) };
        const columns = Object.keys(data).map(camelToSnake);
        const values = Object.entries(data).map(([key, value]) => jsonColumns.has(camelToSnake(key)) && value && typeof value === 'object' ? JSON.stringify(value) : value);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
        const rows = await query(`INSERT INTO ${TABLES[logical]} (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`, values);
        return c.json({ data: mapRow(rows[0]) });
      }
      return c.json({ data: await table.create(body.data || {}) });
    }
    if (operation === 'update') {
      const row = await table.get(body.id);
      await verifyOwnership(logical, row, userId, admin);
      return c.json({ data: await table.update(body.id, body.data || {}) });
    }
    if (operation === 'delete') {
      const row = await table.get(body.id);
      await verifyOwnership(logical, row, userId, admin);
      await table.delete(body.id);
      return c.json({ data: null });
    }
    if (operation === 'deleteMany') throw new Error('deleteMany is not exposed through the browser DB proxy');
    if (operation === 'createMany') throw new Error('createMany is not exposed through the browser DB proxy');
    if (operation === 'upsert') return c.json({ data: await table.upsert(body.data || {}) });
    throw new Error('Unsupported database operation');
  } catch (error: any) {
    const message = error?.message || 'Database request failed';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'Unknown database table' ? 400 : 500;
    return c.json({ error: message }, status);
  }
});

export default app;
