import { getDb, type DbEnv } from '../client';

export async function createTransaction(
  env: DbEnv,
  input: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    description?: string | null;
  },
): Promise<void> {
  await getDb(env).query(
    `INSERT INTO transactions (id, user_id, type, amount, description, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [input.id, input.userId, input.type, input.amount, input.description || null],
  );
}
