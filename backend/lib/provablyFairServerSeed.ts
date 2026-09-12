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
 *
 * The database is authoritative once any seed has been recorded there --
 * BLINK_SERVER_SEED is only a one-time bootstrap fallback for a completely
 * empty table (e.g. a fresh environment), never a permanent override.
 * Previously a configured env var always won and any DB row that didn't
 * match it made this function throw -- which meant that as long as
 * BLINK_SERVER_SEED stayed set in Railway (it does), no rotation of any
 * kind, automatic or via the admin panel, ever actually changed the seed
 * real pack openings and upgrader spins were rolled against. See
 * rotateServerSeed() below for the automated nightly rotation this now
 * enables.
 */
export async function getOrCreateServerSeed(
  configuredSeed = process.env.BLINK_SERVER_SEED,
  db: DbAdapter = defaultDb,
): Promise<ServerSeed> {
  const existing = await findUsableSeed(db);
  if (existing?.seed) {
    return { seed: existing.seed, seedHash: existing.seed_hash };
  }

  return db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_KEY]);
    const lockedExisting = await findUsableSeed({ query: client.query.bind(client) });
    if (lockedExisting?.seed) {
      return { seed: lockedExisting.seed, seedHash: lockedExisting.seed_hash };
    }

    const seed = configuredSeed || generateServerSeed();
    const seedHash = await sha256(seed);
    const id = `seed_${crypto.randomUUID()}`;

    await client.query(
      `INSERT INTO server_seeds(id,seed,seed_hash,active,status,period_start,seed_hash_public)
       VALUES($1,$2,$3,1,'active',now(),$3)`,
      [id, seed, seedHash],
    );

    return { seed, seedHash };
  });
}

/**
 * Rotates the active server seed: reveals whichever seed is genuinely
 * governing rolls right now (resolved via getOrCreateServerSeed, not merely
 * whatever a separate admin-only record claims is active) and activates a
 * fresh one in its place, atomically. Called nightly by the scheduler in
 * provablyFairScheduler.ts, and also available as a manual "Rotate Now" from
 * the admin panel.
 */
export async function rotateServerSeed(db: DbAdapter = defaultDb): Promise<{ oldSeedHash: string; newSeedHash: string }> {
  const current = await getOrCreateServerSeed(process.env.BLINK_SERVER_SEED, db);

  return db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_KEY]);

    await client.query(
      `UPDATE server_seeds
         SET status='revealed', active=0, revealed_at=now(), period_end=now(),
             data = jsonb_set(COALESCE(data,'{}'::jsonb), '{revealedSeed}', to_jsonb(seed))
       WHERE seed_hash=$1`,
      [current.seedHash],
    );

    const newSeed = generateServerSeed();
    const newHash = await sha256(newSeed);
    const id = `seed_${crypto.randomUUID()}`;

    await client.query(
      `INSERT INTO server_seeds(id,seed,seed_hash,active,status,period_start,seed_hash_public)
       VALUES($1,$2,$3,1,'active',now(),$3)`,
      [id, newSeed, newHash],
    );

    return { oldSeedHash: current.seedHash, newSeedHash: newHash };
  });
}
