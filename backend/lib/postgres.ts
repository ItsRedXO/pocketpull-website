import { Pool, type PoolClient, type QueryResultRow } from 'pg';

let pool: Pool | undefined;
let poolUrl: string | undefined;

export function getDb(databaseUrl = process.env.DATABASE_URL): Pool {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL access');
  if (!pool || poolUrl !== databaseUrl) {
    pool?.end().catch(() => undefined);
    pool = new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 });
    poolUrl = databaseUrl;
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getDb().query<T>(sql, params);
  return result.rows;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  poolUrl = undefined;
}
