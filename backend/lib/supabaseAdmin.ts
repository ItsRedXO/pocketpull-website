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
 */
export async function inviteSupabaseIdentity(email: string): Promise<string> {
  const admin = getAdminClient().auth.admin;

  const invited = await admin.inviteUserByEmail(email);
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
