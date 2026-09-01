import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

export type DbEnv = Record<string, string | undefined>;

let pool: Pool | null = null;
let poolKey = '';

export function createPostgresConfig(env: DbEnv): PoolConfig {
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      max: 10,
    };
  }

  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = env;
  if (!PGHOST || !PGUSER || !PGDATABASE) {
    throw new Error(
      'PostgreSQL configuration missing. Set DATABASE_URL or PGHOST, PGUSER, PGDATABASE (and PGPASSWORD when required).',
    );
  }

  return {
    host: PGHOST,
    port: Number(PGPORT || 5432),
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    max: 10,
  };
}

function getPoolKey(config: PoolConfig): string {
  if (config.connectionString) return String(config.connectionString);
  return `${config.host}:${config.port}:${config.database}:${config.user}`;
}

export function getDb(env: DbEnv): Pool {
  const config = createPostgresConfig(env);
  const nextKey = getPoolKey(config);

  if (!pool || poolKey !== nextKey) {
    if (pool) void pool.end().catch(() => undefined);
    pool = new Pool(config);
    poolKey = nextKey;
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  env: DbEnv,
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getDb(env).query<T>(text, values);
}

export async function checkDatabaseConnection(env: DbEnv): Promise<void> {
  await query(env, 'SELECT 1');
}
