import { createClient } from '@supabase/supabase-js';

/**
 * Phase 4 of the Blink -> Supabase Auth migration: a real Supabase session,
 * established opportunistically (see useAuth.ts) for accounts that have
 * already been linked (Phase 3's silent migration). Only ever uses the
 * public anon/publishable key -- never the service-role key, which stays
 * server-only (backend/lib/supabaseAdmin.ts).
 *
 * Blink remains the primary, always-available sign-in path for every
 * account. This client is additive: when it has no session (the common
 * case today, since most real accounts aren't linked yet), callers fall
 * back to Blink -- see getPreferredAuthToken() in ./blink.ts.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pocketpull-supabase-auth' },
    })
  : null;
