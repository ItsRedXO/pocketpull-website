import { getDb, type DbEnv } from '../client';

export async function getActiveOrPendingServerSeed(env: DbEnv, seedHash?: string): Promise<{ id: string; seedHash: string; revealedSeed: string | null; status: string | null } | null> {
  const result = await getDb(env).query(
    `SELECT id, seed_hash, revealed_seed, status
       FROM server_seeds
      WHERE status IN ('active', 'pending')
      ${seedHash ? 'AND seed_hash = $1' : ''}
      ORDER BY created_at DESC
      LIMIT 1`,
    seedHash ? [seedHash] : [],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, seedHash: row.seed_hash, revealedSeed: row.revealed_seed, status: row.status };
}

export async function getUserNonce(env: DbEnv, userId: string): Promise<number> {
  const result = await getDb(env).query(
    `SELECT pack_nonce FROM user_nonces WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return Number(result.rows[0]?.pack_nonce || 0);
}

export async function incrementPackNonce(env: DbEnv, userId: string): Promise<number> {
  const result = await getDb(env).query(
    `INSERT INTO user_nonces (user_id, pack_nonce)
     VALUES ($1, 1)
     ON CONFLICT (user_id)
     DO UPDATE SET pack_nonce = user_nonces.pack_nonce + 1
     RETURNING pack_nonce`,
    [userId],
  );
  return Number(result.rows[0]?.pack_nonce || 0);
}

export async function recordPackOddsVersion(
  env: DbEnv,
  input: { contentHash: string; packId: string; oddsJson: string; cardCount: number },
): Promise<void> {
  await getDb(env).query(
    `INSERT INTO pack_odds_versions (content_hash, pack_id, odds_json, card_count, created_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW())
     ON CONFLICT DO NOTHING`,
    [input.contentHash, input.packId, input.oddsJson, input.cardCount],
  );
}
