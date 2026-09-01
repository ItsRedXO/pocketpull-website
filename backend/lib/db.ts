import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export interface DatabaseEnv {
  DATABASE_URL?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
  PGSSL?: string;
  PGSSLMODE?: string;
  PGPOOL_MAX?: string;
}

export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean;
}

export function normalizeDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  if (env.DATABASE_URL?.trim()) {
    return { connectionString: env.DATABASE_URL.trim(), ssl: env.PGSSL === 'true' || env.PGSSLMODE === 'require' };
  }
  if (!env.PGHOST || !env.PGUSER || !env.PGDATABASE) {
    throw new Error('PostgreSQL configuration missing: set DATABASE_URL or PGHOST/PGUSER/PGDATABASE');
  }
  const port = env.PGPORT || '5432';
  const user = encodeURIComponent(env.PGUSER);
  const password = env.PGPASSWORD ? `:${encodeURIComponent(env.PGPASSWORD)}` : '';
  const database = encodeURIComponent(env.PGDATABASE);
  return {
    connectionString: `postgresql://${user}${password}@${env.PGHOST}:${port}/${database}`,
    ssl: env.PGSSL === 'true' || env.PGSSLMODE === 'require',
  };
}

let pool: Pool | null = null;

export function getPool(env: DatabaseEnv = process.env): Pool {
  if (!pool) {
    const config = normalizeDatabaseConfig(env);
    pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: Number(env.PGPOOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export function resetPool(): void {
  pool = null;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row: QueryResultRow): any {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamelCase(key), value]));
}

function tableName(name: string): string {
  const known: Record<string, string> = {
    packsCatalog: 'packs_catalog',
    packCards: 'pack_cards',
    packCooldowns: 'pack_cooldowns',
    serverSeeds: 'server_seeds',
    packOddsVersions: 'pack_odds_versions',
    userNonces: 'user_nonces',
    packsOpened: 'packs_opened',
    walletTransactions: 'wallet_transactions',
    activityLogs: 'activity_logs',
  };
  return known[name] || toSnakeCase(name);
}

function columnName(name: string): string {
  return toSnakeCase(name);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

interface WhereResult { sql: string; values: any[]; }

function buildWhere(where: Record<string, any> | undefined, startIndex = 1): WhereResult {
  if (!where || Object.keys(where).length === 0) return { sql: '', values: [] };
  const clauses: string[] = [];
  const values: any[] = [];
  let index = startIndex;

  for (const [field, condition] of Object.entries(where)) {
    const column = quoteIdentifier(columnName(field));
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [operator, value] of Object.entries(condition)) {
        if (operator === 'in') {
          const items = Array.isArray(value) ? value : [];
          if (!items.length) { clauses.push('1 = 0'); continue; }
          clauses.push(`${column} IN (${items.map(() => `$${index++}`).join(', ')})`);
          values.push(...items);
        } else if (operator === 'notIn') {
          const items = Array.isArray(value) ? value : [];
          if (!items.length) continue;
          clauses.push(`${column} NOT IN (${items.map(() => `$${index++}`).join(', ')})`);
          values.push(...items);
        } else if (operator === 'gte') {
          clauses.push(`${column} >= $${index++}`); values.push(value);
        } else if (operator === 'lte') {
          clauses.push(`${column} <= $${index++}`); values.push(value);
        } else if (operator === 'gt') {
          clauses.push(`${column} > $${index++}`); values.push(value);
        } else if (operator === 'lt') {
          clauses.push(`${column} < $${index++}`); values.push(value);
        } else if (operator === 'neq') {
          clauses.push(`${column} <> $${index++}`); values.push(value);
        } else if (operator === 'like') {
          clauses.push(`${column} LIKE $${index++}`); values.push(value);
        } else if (operator === 'isNull') {
          clauses.push(value ? `${column} IS NULL` : `${column} IS NOT NULL`);
        }
      }
      continue;
    }
    if (condition === null) clauses.push(`${column} IS NULL`);
    else { clauses.push(`${column} = $${index++}`); values.push(condition); }
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}

function orderByClause(orderBy: Record<string, 'asc' | 'desc'> | undefined): string {
  if (!orderBy) return '';
  const entries = Object.entries(orderBy);
  if (!entries.length) return '';
  return ` ORDER BY ${entries.map(([field, direction]) => `${quoteIdentifier(columnName(field))} ${String(direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`).join(', ')}`;
}

function valuesForRecord(record: Record<string, any>): { columns: string[]; values: any[] } {
  const entries = Object.entries(record);
  return { columns: entries.map(([key]) => quoteIdentifier(columnName(key))), values: entries.map(([, value]) => value) };
}

export class PostgresTable<T extends Record<string, any> = any> {
  constructor(private readonly db: PostgresDatabase, private readonly name: string) {}

  async get(id: string): Promise<T | null> {
    const result = await this.db.query(`SELECT * FROM ${quoteIdentifier(tableName(this.name))} WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? mapRow(result.rows[0]) as T : null;
  }

  async list(options: { where?: Record<string, any>; orderBy?: Record<string, 'asc' | 'desc'>; limit?: number; offset?: number } = {}): Promise<T[]> {
    const where = buildWhere(options.where);
    const values = [...where.values];
    let sql = `SELECT * FROM ${quoteIdentifier(tableName(this.name))}${where.sql}${orderByClause(options.orderBy)}`;
    if (options.limit !== undefined) { sql += ` LIMIT $${values.length + 1}`; values.push(options.limit); }
    if (options.offset !== undefined) { sql += ` OFFSET $${values.length + 1}`; values.push(options.offset); }
    const result = await this.db.query(sql, values);
    return result.rows.map(mapRow) as T[];
  }

  async count(options: { where?: Record<string, any> } = {}): Promise<number> {
    const where = buildWhere(options.where);
    const result = await this.db.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName(this.name))}${where.sql}`, where.values);
    return Number(result.rows[0]?.count || 0);
  }

  async exists(options: { where?: Record<string, any> } = {}): Promise<boolean> {
    const where = buildWhere(options.where);
    const result = await this.db.query(`SELECT 1 FROM ${quoteIdentifier(tableName(this.name))}${where.sql} LIMIT 1`, where.values);
    return result.rowCount > 0;
  }

  async create(record: Record<string, any>): Promise<T> {
    const { columns, values } = valuesForRecord(record);
    const result = await this.db.query(`INSERT INTO ${quoteIdentifier(tableName(this.name))} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, values);
    return mapRow(result.rows[0]) as T;
  }

  async update(id: string, record: Record<string, any>): Promise<T | null> {
    const entries = Object.entries(record);
    if (!entries.length) return this.get(id);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], i) => `${quoteIdentifier(columnName(key))} = $${i + 1}`);
    values.push(id);
    const result = await this.db.query(`UPDATE ${quoteIdentifier(tableName(this.name))} SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    return result.rows[0] ? mapRow(result.rows[0]) as T : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM ${quoteIdentifier(tableName(this.name))} WHERE id = $1`, [id]);
    return result.rowCount > 0;
  }

  async deleteMany(options: { where?: Record<string, any> } = {}): Promise<number> {
    const where = buildWhere(options.where);
    const result = await this.db.query(`DELETE FROM ${quoteIdentifier(tableName(this.name))}${where.sql}`, where.values);
    return result.rowCount;
  }

  async upsert(record: Record<string, any>, conflictColumns?: string[]): Promise<T> {
    const { columns, values } = valuesForRecord(record);
    const conflict = (conflictColumns?.length ? conflictColumns : ['id']).map(columnName);
    const updateColumns = Object.keys(record).filter((key) => !conflict.includes(columnName(key)));
    const assignments = updateColumns.length
      ? updateColumns.map((key) => `${quoteIdentifier(columnName(key))} = EXCLUDED.${quoteIdentifier(columnName(key))}`).join(', ')
      : `${quoteIdentifier(conflict[0])} = EXCLUDED.${quoteIdentifier(conflict[0])}`;
    const result = await this.db.query(
      `INSERT INTO ${quoteIdentifier(tableName(this.name))} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${conflict.map(quoteIdentifier).join(', ')}) DO UPDATE SET ${assignments} RETURNING *`,
      values,
    );
    return mapRow(result.rows[0]) as T;
  }
}

export class PostgresDatabase {
  constructor(private readonly env: DatabaseEnv = process.env) {}

  table<T extends Record<string, any> = any>(name: string): PostgresTable<T> { return new PostgresTable<T>(this, name); }
  get users() { return this.table('users'); }
  get packsCatalog() { return this.table('packsCatalog'); }
  get packCards() { return this.table('packCards'); }
  get packCooldowns() { return this.table('packCooldowns'); }
  get serverSeeds() { return this.table('serverSeeds'); }
  get inventory() { return this.table('inventory'); }
  get transactions() { return this.table('transactions'); }
  get battles() { return this.table('battles'); }
  get walletTransactions() { return this.table('walletTransactions'); }
  get activityLogs() { return this.table('activityLogs'); }

  async query<T extends QueryResultRow = any>(text: string, values: any[] = []): Promise<QueryResult<T>> { return getPool(this.env).query<T>(text, values); }
  async sql<T extends QueryResultRow = any>(text: string, values: any[] = []): Promise<QueryResult<T>> {
    let parameter = 0;
    return this.query<T>(text.replace(/\?/g, () => `$${++parameter}`), values);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool(this.env).connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}

export function createDatabase(env: DatabaseEnv = process.env): PostgresDatabase { return new PostgresDatabase(env); }
