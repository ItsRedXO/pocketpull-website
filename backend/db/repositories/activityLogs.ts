import { getDb, type DbEnv } from '../client';

export interface ActivityLogInput {
  id: string;
  type: string;
  userId: string | null;
  username: string;
  action: string;
  details: Record<string, unknown>;
  valueIn?: number;
  valueOut?: number;
  result?: string | null;
  metadata?: Record<string, unknown>;
}

function mapRow(row: any) {
  let details: Record<string, unknown> = {};
  try { details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {}); } catch {}
  return {
    id: row.id,
    type: row.type,
    userId: row.user_id,
    username: row.username || 'Unknown',
    action: row.action,
    details,
    valueIn: Number(row.value_in || 0),
    valueOut: Number(row.value_out || 0),
    result: row.result,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

export async function createActivityLog(env: DbEnv, input: ActivityLogInput): Promise<void> {
  await getDb(env).query(`
    INSERT INTO activity_logs
      (id,type,user_id,username,action,details,value_in,value_out,result,metadata,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW())
    ON CONFLICT (id) DO NOTHING`, [
      input.id, input.type, input.userId, input.username || 'Unknown', input.action,
      JSON.stringify(input.details || {}), input.valueIn || 0, input.valueOut || 0,
      input.result || null, JSON.stringify(input.metadata || {}),
    ]);
}

export async function listActivityLogs(env: DbEnv, options: {
  userId?: string;
  type?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}) {
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (options.userId) where.push(`user_id = ${add(options.userId)}`);
  if (options.type) where.push(`type = ${add(options.type)}`);
  if (options.search) {
    const q = `%${options.search}%`;
    const p = add(q);
    where.push(`(username ILIKE ${p} OR action ILIKE ${p} OR details ILIKE ${p})`);
  }
  if (options.dateFrom) where.push(`created_at >= ${add(options.dateFrom)}`);
  if (options.dateTo) where.push(`created_at < (${add(options.dateTo)}::date + INTERVAL '1 day')`);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await getDb(env).query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM activity_logs ${clause}`, values);
  const rows = await getDb(env).query(`
    SELECT id,type,user_id,username,action,details,value_in,value_out,result,metadata,created_at
      FROM activity_logs ${clause} ORDER BY created_at DESC LIMIT ${add(options.limit)} OFFSET ${add(options.offset)}`, values);
  return { rows: rows.rows.map(mapRow), total: Number(count.rows[0]?.count || 0) };
}
