import { blink } from '../lib/blink';
import { supabase } from '../lib/supabase';

/** Returns a Bearer token for the current session: Blink if available, then Supabase. */
export async function getAdminToken(): Promise<string | null> {
  const blinkToken = await blink.auth.getValidToken().catch(() => null);
  if (blinkToken) return blinkToken;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) return token;
    } catch {}
  }
  return null;
}

/** Returns fetch headers with Authorization + X-Admin-Secret for admin API calls. */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAdminToken();
  const secret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(secret ? { 'X-Admin-Secret': secret } : {}),
  };
}
