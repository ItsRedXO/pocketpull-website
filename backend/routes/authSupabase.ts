import { Hono } from 'hono';
import { requireAuth, uid } from '../lib/auth';
import { verifySupabaseToken, extractSupabaseBearer } from '../lib/supabaseAuth';
import { getOrCreateSupabaseIdentity, inviteSupabaseIdentity, backfillPasswordIfNeeded } from '../lib/supabaseAdmin';
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
 * POST /auth/silent-migrate
 *
 * Phase 3: fired best-effort by the frontend immediately after a successful
 * Blink sign-in (see src/hooks/useAuth.ts). Silently creates and links a
 * Supabase Auth identity for this account using the password the user just
 * typed, so real accounts get migrated over time with zero user-facing
 * action. Idempotent and safe to call on every login -- a no-op once
 * auth_user_id is already set. Never touches balance, inventory,
 * transactions, or any other field.
 *
 * This is the one place in the backend where a plaintext password arrives
 * from the client. It is used only to mirror the credential into Supabase
 * via the Admin API (see ../lib/supabaseAdmin.ts) and is never persisted.
 *
 * Always returns 200 except for auth/validation failures -- this must never
 * block or surface an error to a user who just successfully logged in via
 * Blink; migration is a best-effort side effect, not a login gate.
 *
 * Also closes the bulk-invite gap: if this account was already linked by the
 * bulk-backfill (/admin/auth/bulk-migrate-next) and never had a password set,
 * backfillPasswordIfNeeded sets one from the password just used to sign in.
 * No-op for every other already-linked account (see its own doc comment).
 */
app.post('/auth/silent-migrate', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';

  const rows = await query<{ id: string; email: string | null; auth_user_id: string | null }>(
    'SELECT id, email, auth_user_id FROM users WHERE id=$1 LIMIT 1',
    [userId]
  );
  const existing = rows[0];
  if (!existing) return c.json({ error: 'Account not found' }, 404);

  if (existing.auth_user_id) {
    const passwordBackfilled = password
      ? await backfillPasswordIfNeeded(existing.auth_user_id, password)
      : false;
    return c.json({ success: true, migrated: false, alreadyLinked: true, passwordBackfilled });
  }
  if (!existing.email) {
    return c.json({ error: 'No email on file for this account' }, 400);
  }
  if (!password) {
    return c.json({ error: 'Password required' }, 400);
  }

  let supabaseUserId: string;
  try {
    supabaseUserId = await getOrCreateSupabaseIdentity(existing.email, password);
  } catch (err: any) {
    console.error('[auth/silent-migrate] Supabase identity error:', err?.message || err);
    return c.json({ success: false, migrated: false, error: 'Migration deferred' });
  }

  try {
    await query('UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL', [supabaseUserId, userId]);
  } catch (err: any) {
    // Unique constraint violation: this Supabase identity is already linked elsewhere.
    // Not this request's problem to resolve -- just don't crash the caller's login.
    if (err?.code === '23505') return c.json({ success: true, migrated: false });
    console.error('[auth/silent-migrate] link error:', err?.message || err);
    return c.json({ success: false, migrated: false, error: 'Migration deferred' });
  }

  return c.json({ success: true, migrated: true });
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

/**
 * POST /admin/auth/bulk-migrate-next
 *
 * One-shot bulk-backfill step, called repeatedly (e.g. by a throttled
 * scheduled task) to migrate accounts that have never logged in since the
 * silent-migration flow shipped, and so never had a chance to mirror their
 * password into Supabase. Unlike /auth/silent-migrate, this never sees a
 * password: it creates a passwordless Supabase identity and sends Supabase's
 * built-in invite email (a "set your password" link) via inviteSupabaseIdentity.
 *
 * Protected by a dedicated MIGRATION_TASK_SECRET (not the general admin
 * secret) since this is only ever called by the automated backfill task, not
 * a human admin session.
 *
 * Picks exactly one account per call (oldest-first, by id) so the caller can
 * throttle to Supabase's email-sending rate limit. Returns {done:true} once
 * no real, unlinked account remains.
 */
app.post('/admin/auth/bulk-migrate-next', async (c) => {
  const secret = c.req.header('X-Migration-Secret');
  if (!secret || secret !== process.env.MIGRATION_TASK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rows = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users
     WHERE is_deleted=0 AND is_bot=0 AND email IS NOT NULL AND auth_user_id IS NULL
       AND email NOT LIKE '%@blink.new'
     ORDER BY id ASC LIMIT 1`
  );
  const next = rows[0];
  if (!next) return c.json({ done: true });

  let supabaseUserId: string;
  try {
    supabaseUserId = await inviteSupabaseIdentity(next.email);
  } catch (err: any) {
    console.error('[admin/auth/bulk-migrate-next] invite error:', err?.message || err);
    return c.json({ done: false, error: err?.message || 'Invite failed', skipped: next.email }, 502);
  }

  try {
    await query('UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL', [supabaseUserId, next.id]);
  } catch (err: any) {
    if (err?.code === '23505') return c.json({ done: false, migrated: false, note: 'already linked elsewhere' });
    throw err;
  }

  return c.json({ done: false, migrated: next.email });
});

/**
 * GET /admin/auth/debug-link/:userId
 *
 * Temporary, throwaway diagnostic (same pattern as the earlier
 * /admin/auth/bulk-link -- protected by the same single-purpose
 * BULK_LINK_SECRET, to be removed once used). Reports whether a specific
 * usr_XXXX row has an auth_user_id set, to resolve a one-off discrepancy
 * from the earlier bulk hash-migration script.
 */
app.get('/admin/auth/debug-link/:userId', async (c) => {
  const secret = c.req.header('X-Bulk-Link-Secret');
  if (!secret || secret !== process.env.BULK_LINK_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  const userId = c.req.param('userId');
  const rows = await query<{ id: string; email: string; auth_user_id: string | null }>('SELECT id, email, auth_user_id FROM users WHERE id=$1', [userId]);
  return c.json({ found: rows.length > 0, row: rows[0] || null });
});

/**
 * POST /admin/auth/debug-link/:userId
 *
 * Same secret/lifetime as the GET above -- links this one account if it
 * isn't already (idempotent, only sets auth_user_id when currently NULL).
 * Body: { authUserId: string }.
 */
app.post('/admin/auth/debug-link/:userId', async (c) => {
  const secret = c.req.header('X-Bulk-Link-Secret');
  if (!secret || secret !== process.env.BULK_LINK_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  const userId = c.req.param('userId');
  const body = await c.req.json().catch(() => ({}));
  const authUserId = String(body?.authUserId || '');
  if (!authUserId) return c.json({ error: 'authUserId required' }, 400);
  const rows = await query<{ id: string }>('UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL RETURNING id', [authUserId, userId]);
  return c.json({ linked: rows.length > 0 });
});

/**
 * POST /auth/complete-supabase-signup
 *
 * Phase 5: creates the PocketPull account row for a brand-new,
 * Supabase-native signup (one that never touched Blink at all). Takes no
 * body -- username and referralCode were embedded in the Supabase user's
 * own metadata at supabase.auth.signUp() time (options.data), so this
 * works identically whether a session exists immediately (email
 * confirmation off) or only later once the user clicks the confirmation
 * link (the frontend calls this the first time it sees *any* verified
 * Supabase session with no linked account -- see useSupabaseAuthUser in
 * useAuth.ts). Idempotent: a second call for an already-linked identity
 * just returns the existing account instead of erroring.
 */
app.post('/auth/complete-supabase-signup', async (c) => {
  let claims;
  try {
    const token = extractSupabaseBearer(c.req.header('Authorization'));
    claims = await verifySupabaseToken(token);
  } catch (err: any) {
    return c.json({ error: `Supabase token invalid: ${err.message}` }, 401);
  }
  if (!claims.email) return c.json({ error: 'Supabase account has no email on the token' }, 400);

  const existingLink = await query<{ id: string }>('SELECT id FROM users WHERE auth_user_id=$1 LIMIT 1', [claims.authUserId]);
  if (existingLink[0]) return c.json({ success: true, userId: existingLink[0].id, alreadyExists: true });

  const meta = (claims.raw?.user_metadata as Record<string, unknown>) || {};
  let username = String(meta.username || '').trim();
  const referralCodeInput = String(meta.referralCode || '').trim().toUpperCase();

  if (username && (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username))) username = '';
  if (username) {
    const taken = await query('SELECT 1 FROM users WHERE lower(username)=lower($1) LIMIT 1', [username]);
    if (taken.length) username = '';
  }
  const userId = `usr_${uid()}`;
  if (!username) username = `Trainer_${userId.slice(-4)}`;

  const emailTaken = await query('SELECT 1 FROM users WHERE lower(email)=lower($1) LIMIT 1', [claims.email]);
  if (emailTaken.length) return c.json({ error: 'EMAIL_ALREADY_EXISTS' }, 409);

  let referredById: string | null = null;
  if (referralCodeInput) {
    const referrer = await query<{ id: string }>('SELECT id FROM users WHERE referral_code=$1 LIMIT 1', [referralCodeInput]);
    referredById = referrer[0]?.id || null;
  }

  const referralCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  await query(
    `INSERT INTO users (id, email, username, display_name, avatar_url, balance, matched_balance, email_verified, role, is_banned, is_deleted, referral_code, referred_by_id, referral_reward_paid, auth_user_id)
     VALUES ($1,$2,$3,$3,'',0,0,1,'',0,0,$4,$5,0,$6)`,
    [userId, claims.email, username, referralCode, referredById, claims.authUserId]
  );

  return c.json({ success: true, userId, alreadyExists: false });
});

export default app;
