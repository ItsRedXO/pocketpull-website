import { query, transaction } from './postgres';
import { sha256 } from './provablyFair';

export type ServerSeed = {
  seed: string;
  seedHash: string;
};

type DbResult = { rowCount?: number | null; rows: any[] };
type DbClient = { query: (sql: string, params?: unknown[]) => Promise<DbResult> };
type DbQuery = (sql: string, params?: unknown[]) => Promise<any[] | DbResult>;
type DbAdapter = {
  query: DbQuery;
  transaction: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;
};

const defaultDb: DbAdapter = { query, transaction };
const BOOTSTRAP_LOCK_KEY = 1958574392;

function generateServerSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function findUsableSeed(db: Pick<DbAdapter, 'query'>): Promise<any | null> {
  const result = await db.query(
    `SELECT seed,seed_hash,status,active
     FROM server_seeds
     WHERE seed IS NOT NULL
       AND seed_hash IS NOT NULL
       AND (status IN ('active','pending') OR active=1)
     ORDER BY created_at DESC
     LIMIT 10`,
  );
  const rows = Array.isArray(result) ? result : result.rows;
  return rows[0] || null;
}

/**
 * Resolve the server seed used by PostgreSQL-backed provably-fair operations.
 * A configured legacy BLINK_SERVER_SEED is reused when it matches the DB
 * commitment; otherwise an existing active DB seed is used. If neither exists,
 * one is generated and persisted atomically so Railway can operate without the
 * old Blink environment variable.
 */
export async function getOrCreateServerSeed(
  configuredSeed = process.env.BLINK_SERVER_SEED,
  db: DbAdapter = defaultDb,
): Promise<ServerSeed> {
  const configuredHash = configuredSeed ? await sha256(configuredSeed) : null;
  const existing = await findUsableSeed(db);

  if (configuredSeed) {
    if (existing) {
      if (existing.seed_hash !== configuredHash) {
        throw new Error('Provably fair seed mismatch: configured seed does not match the active PostgreSQL commitment');
      }
      return { seed: configuredSeed, seedHash: configuredHash! };
    }
  } else if (existing?.seed) {
    return { seed: existing.seed, seedHash: existing.seed_hash };
  }

  return db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_KEY]);
    const lockedExisting = await findUsableSeed({ query: client.query.bind(client) });

    if (configuredSeed) {
      if (lockedExisting) {
        if (lockedExisting.seed_hash !== configuredHash) {
          throw new Error('Provably fair seed mismatch: configured seed does not match the active PostgreSQL commitment');
        }
        return { seed: configuredSeed, seedHash: configuredHash! };
      }
    } else if (lockedExisting?.seed) {
      return { seed: lockedExisting.seed, seedHash: lockedExisting.seed_hash };
    }

    const seed = configuredSeed || generateServerSeed();
    const seedHash = configuredHash || await sha256(seed);
    const id = `seed_${crypto.randomUUID()}`;

    await client.query(
      `INSERT INTO server_seeds(id,seed,seed_hash,active,status,period_start,seed_hash_public)
       VALUES($1,$2,$3,1,'active',now(),$3)`,
      [id, seed, seedHash],
    );

    return { seed, seedHash };
  });
}
