import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase Admin API access (service_role key). Used exclusively
 * by the Phase 3 silent-migration flow (backend/routes/authSupabase.ts) to
 * create a Supabase Auth identity for an existing PocketPull account using
 * the password the user just typed into the (still Blink-powered) login
 * form. Never imported by frontend code; SUPABASE_SERVICE_ROLE_KEY must
 * never be exposed to the browser.
 */

let adminClient: SupabaseClient | undefined;

function getAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required for Supabase admin operations');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Supabase admin operations');
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/**
 * Creates a Supabase Auth user for this email/password and returns its id.
 * If a Supabase identity for this email already exists (e.g. the Phase 1
 * pilot account, created manually via the dashboard), finds and returns its
 * id instead -- without ever overwriting that existing identity's password.
 */
export async function getOrCreateSupabaseIdentity(email: string, password: string): Promise<string> {
  const admin = getAdminClient().auth.admin;

  const created = await admin.createUser({ email, password, email_confirm: true });
  if (!created.error) {
    if (!created.data.user) throw new Error('Supabase admin createUser returned no user');
    return created.data.user.id;
  }
  if (created.error.code !== 'email_exists') throw created.error;

  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || '').trim().toLowerCase() === normalizedEmail);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Supabase reports email already registered, but no matching user was found`);
}

/**
 * Bulk-backfill path: creates a Supabase Auth identity with no password set
 * and sends Supabase's built-in invite email (a "set your password" link),
 * for accounts that have never logged in since the silent-migration flow
 * shipped and so never had a chance to mirror their password. If an identity
 * for this email already exists, returns its id instead of erroring (mirrors
 * getOrCreateSupabaseIdentity's dedupe behavior) without sending a duplicate
 * invite.
 *
 * Tags the identity with `pp_needs_password_backfill: true` in its
 * user_metadata so a later normal login (see backfillPasswordIfNeeded) can
 * recognize it never got a real password and safely set one, without ever
 * touching a password on an identity that was created some other way.
 */
export async function inviteSupabaseIdentity(email: string): Promise<string> {
  const admin = getAdminClient().auth.admin;

  const invited = await admin.inviteUserByEmail(email, { data: { pp_needs_password_backfill: true } });
  if (!invited.error) {
    if (!invited.data.user) throw new Error('Supabase admin inviteUserByEmail returned no user');
    return invited.data.user.id;
  }
  if (invited.error.code !== 'email_exists') throw invited.error;

  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || '').trim().toLowerCase() === normalizedEmail);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Supabase reports email already registered, but no matching user was found`);
}

/**
 * Silently creates a passwordless, pre-confirmed Supabase identity for this
 * email if one doesn't already exist -- unlike inviteSupabaseIdentity, this
 * never sends Supabase's own "invite" email. Used only as a fallback inside
 * generatePasswordResetToken, for accounts that request a password reset
 * before ever having logged in since the Supabase migration started (so
 * they have no linked identity yet to generate a recovery link against).
 */
async function ensureSupabaseIdentity(email: string): Promise<string> {
  const admin = getAdminClient().auth.admin;

  const created = await admin.createUser({ email, email_confirm: true });
  if (!created.error) {
    if (!created.data.user) throw new Error('Supabase admin createUser returned no user');
    return created.data.user.id;
  }
  if (created.error.code !== 'email_exists') throw created.error;

  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || '').trim().toLowerCase() === normalizedEmail);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Supabase reports email already registered, but no matching user was found`);
}

/**
 * Generates a password-recovery token via the Admin API without sending
 * Supabase's own email -- the caller (POST /auth/password-reset) sends its
 * own branded email via Resend instead, embedding a link to our own
 * /reset-password page in the form `?token_hash=...&type=recovery`, which
 * that page resolves itself via `supabase.auth.verifyOtp()`. This sidesteps
 * both halves of the previous double-email bug: Blink's own reset email
 * (which the reset page can never recognize, since it only understands
 * Supabase sessions) and Supabase's own built-in mailer/redirect flow
 * (`resetPasswordForEmail` + its hosted `/auth/v1/verify` redirect, which
 * depends on the project's configured Redirect URL allow-list).
 */
export async function generatePasswordResetToken(email: string): Promise<{ tokenHash: string; authUserId: string }> {
  const admin = getAdminClient().auth.admin;

  let generated = await admin.generateLink({ type: 'recovery', email });
  if (generated.error) {
    // No Supabase identity for this email yet (account never migrated) --
    // create one silently and retry.
    await ensureSupabaseIdentity(email);
    generated = await admin.generateLink({ type: 'recovery', email });
    if (generated.error) throw generated.error;
  }

  const hashedToken = generated.data?.properties?.hashed_token;
  const authUserId = generated.data?.user?.id;
  if (!hashedToken || !authUserId) throw new Error('Supabase did not return a recovery token');
  return { tokenHash: hashedToken, authUserId };
}

/**
 * Closes the gap the bulk-invite path leaves open: an account invited via
 * inviteSupabaseIdentity has a Supabase identity but no password until the
 * user clicks that email. Most real users just keep logging in normally via
 * Blink instead, so this is called from /auth/silent-migrate on every login
 * for an already-linked account -- if (and only if) that identity is still
 * tagged `pp_needs_password_backfill`, sets its password to the one the user
 * just typed (which just succeeded against Blink, so it's known-correct) and
 * clears the tag. No-ops for every other identity, including ones created by
 * getOrCreateSupabaseIdentity or manually (e.g. the Phase 1 pilot) -- those
 * are never tagged, so their password is never touched.
 *
 * Best-effort: swallows its own errors and returns false rather than ever
 * throwing, since this must not be allowed to block or fail a login.
 */
export async function backfillPasswordIfNeeded(authUserId: string, password: string): Promise<boolean> {
  const admin = getAdminClient().auth.admin;
  try {
    const { data, error } = await admin.getUserById(authUserId);
    if (error || !data.user) return false;
    if (data.user.user_metadata?.pp_needs_password_backfill !== true) return false;

    const { error: updateError } = await admin.updateUserById(authUserId, {
      password,
      user_metadata: { ...data.user.user_metadata, pp_needs_password_backfill: false },
    });
    return !updateError;
  } catch (err: any) {
    console.error('[backfillPasswordIfNeeded] error:', err?.message || err);
    return false;
  }
}
