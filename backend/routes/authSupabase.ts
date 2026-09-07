import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { verifySupabaseToken, extractSupabaseBearer } from '../lib/supabaseAuth';
import { query } from '../lib/postgres';

const app = new Hono();

/**
 * POST /auth/link-supabase
 *
 * One-time linking step for the parallel-run migration. Requires proof of
 * BOTH identities in the same request:
 *   - Authorization: Bearer <existing Blink token>   (proves the usr_XXXX account today)
 *   - X-Supabase-Token: Bearer <new Supabase access token>  (proves the new Supabase identity)
 *
 * Only ever sets auth_user_id when it is currently NULL, and only when the
 * Supabase account's verified email matches the email already on file for
 * that usr_XXXX row. Never touches balance, inventory, transactions, or any
 * other field. Safe to call multiple times (idempotent no-op once linked).
 */
app.post('/auth/link-supabase', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Existing account authentication required' }, 401);
  }

  let supabaseClaims;
  try {
    const supabaseToken = extractSupabaseBearer(c.req.header('X-Supabase-Token'));
    supabaseClaims = await verifySupabaseToken(supabaseToken);
  } catch (err: any) {
    return c.json({ error: `Supabase token invalid: ${err.message}` }, 401);
  }
  if (!supabaseClaims.email) {
    return c.json({ error: 'Supabase account has no verified email on the token' }, 400);
  }

  const rows = await query<{ id: string; email: string | null; auth_user_id: string | null }>(
    'SELECT id, email, auth_user_id FROM users WHERE id=$1 LIMIT 1',
    [userId]
  );
  const existing = rows[0];
  if (!existing) return c.json({ error: 'Account not found' }, 404);

  if (!existing.email || existing.email.toLowerCase() !== supabaseClaims.email.toLowerCase()) {
    return c.json({ error: 'Supabase account email does not match the email on file for this PocketPull account' }, 409);
  }

  if (existing.auth_user_id) {
    if (existing.auth_user_id === supabaseClaims.authUserId) {
      return c.json({ success: true, alreadyLinked: true, userId: existing.id });
    }
    return c.json({ error: 'This PocketPull account is already linked to a different Supabase identity' }, 409);
  }

  try {
    await query(
      'UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL',
      [supabaseClaims.authUserId, userId]
    );
  } catch (err: any) {
    // Unique constraint violation: this Supabase identity is already linked elsewhere.
    if (err?.code === '23505') {
      return c.json({ error: 'This Supabase identity is already linked to a different PocketPull account' }, 409);
    }
    throw err;
  }

  return c.json({ success: true, alreadyLinked: false, userId: existing.id });
});

/**
 * GET /auth/whoami-supabase
 *
 * Read-only acceptance-test endpoint for the migration. Accepts ONLY a
 * Supabase access token (no Blink token at all) and resolves it end to end
 * to the linked PocketPull account. This is what proves out the migration
 * gate: "a real account authenticates through Supabase and resolves to its
 * original usr_XXXX account with the correct balance/permissions."
 *
 * Not wired into any existing route. Does not modify anything.
 */
app.get('/auth/whoami-supabase', async (c) => {
  let supabaseClaims;
  try {
    const supabaseToken = extractSupabaseBearer(c.req.header('Authorization'));
    supabaseClaims = await verifySupabaseToken(supabaseToken);
  } catch (err: any) {
    return c.json({ error: `Supabase token invalid: ${err.message}` }, 401);
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT u.id, u.username, u.display_name, u.email, u.balance, u.matched_balance,
            u.role, u.is_admin, u.is_moderator, u.is_banned, u.is_deleted, u.created_at,
            (SELECT count(*) FROM inventory i WHERE i.user_id = u.id) AS inventory_count,
            (SELECT count(*) FROM wallet_transactions w WHERE w.user_id = u.id) AS wallet_transaction_count,
            (SELECT count(*) FROM transactions t WHERE t.user_id = u.id) AS transaction_count
     FROM users u
     WHERE u.auth_user_id = $1
     LIMIT 1`,
    [supabaseClaims.authUserId]
  );

  if (!rows[0]) {
    return c.json({ error: 'No PocketPull account is linked to this Supabase identity yet' }, 404);
  }

  return c.json({ success: true, account: rows[0] });
});

export default app;
