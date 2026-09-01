import { query, type DbEnv } from '../client';

export interface UserAuthState {
  id: string;
  isDeleted: boolean;
  isBanned: boolean;
}

export async function getUserAuthState(env: DbEnv, userId: string): Promise<UserAuthState | null> {
  const result = await query<{
    id: string;
    is_deleted: boolean;
    is_banned: boolean;
  }>(
    env,
    'SELECT id, is_deleted, is_banned FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    isDeleted: Boolean(row.is_deleted),
    isBanned: Boolean(row.is_banned),
  };
}
