import { query, type DbEnv } from '../client';

export async function countLivePublicBattles(env: DbEnv): Promise<number> {
  const result = await query<{ count: string }>(
    env,
    `SELECT COUNT(*)::text AS count
       FROM battles
      WHERE status IN ('waiting', 'live')
        AND is_public = TRUE`,
  );

  return Number(result.rows[0]?.count || 0);
}
