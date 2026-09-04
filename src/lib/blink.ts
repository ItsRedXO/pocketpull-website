import { createPostgresDb } from './postgresDb';
import { BACKEND_BASE } from './backend';

type AuthUser = { id: string; email?: string; displayName?: string; emailVerified?: boolean; [key: string]: unknown };
type AuthState = { user: AuthUser | null; isLoading: boolean };
type Listener = (state: AuthState) => void;

const SUPABASE_URL = String((import.meta as any).env?.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '');
const ACCESS_TOKEN_KEY = 'pocketpull_supabase_access_token';
const REFRESH_TOKEN_KEY = 'pocketpull_supabase_refresh_token';
let currentUser: AuthUser | null = null;
let accessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
const listeners = new Set<Listener>();

function headers(token?: string | null): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
}
function mapUser(raw: any): AuthUser | null {
  if (!raw?.id) return null;
  return { id: raw.id, email: raw.email, displayName: raw.user_metadata?.displayName || raw.user_metadata?.display_name || raw.user_metadata?.username || '', emailVerified: !!raw.email_confirmed_at };
}
function publish(isLoading = false) { const state = { user: currentUser, isLoading }; listeners.forEach(listener => listener(state)); }
async function refreshUser() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !accessToken) { currentUser = null; publish(false); return; }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: headers(accessToken) });
  if (!response.ok) { accessToken = null; localStorage.removeItem(ACCESS_TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); currentUser = null; publish(false); return; }
  currentUser = mapUser(await response.json()); publish(false);
}
async function resolveLoginEmail(identifier: string): Promise<string> {
  if (identifier.includes('@')) return identifier;
  const response = await fetch(`${BACKEND_BASE}/auth/user-lookup?username=${encodeURIComponent(identifier)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload.users) || payload.users.length === 0) throw new Error('INVALID_CREDENTIALS');
  const row = payload.users[0];
  if (Number(row.is_banned || 0) > 0) throw new Error('BANNED_ACCOUNT');
  if (Number(row.is_deleted || 0) > 0 || !row.email) throw new Error('INVALID_CREDENTIALS');
  return String(row.email);
}
async function authRequest(path: string, body?: unknown) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase authentication is not configured');
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, { method: 'POST', headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error: any = new Error(payload?.error_description || payload?.msg || payload?.message || 'Authentication failed'); error.status = response.status; throw error; }
  if (payload.access_token) { accessToken = payload.access_token; localStorage.setItem(ACCESS_TOKEN_KEY, payload.access_token); if (payload.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh_token); currentUser = mapUser(payload.user); publish(false); }
  return payload;
}
const auth = {
  getValidToken: async () => accessToken,
  onAuthStateChanged: (listener: Listener) => { listeners.add(listener); listener({ user: currentUser, isLoading: true }); void refreshUser(); return () => listeners.delete(listener); },
  signInWithEmail: async (emailOrUsername: string, password: string) => authRequest('/token?grant_type=password', { email: await resolveLoginEmail(emailOrUsername), password }),
  signUp: ({ email, password, displayName }: { email: string; password: string; displayName: string }) => authRequest('/signup', { email, password, data: { displayName, username: displayName } }),
  signOut: async () => { if (SUPABASE_URL && accessToken) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: headers(accessToken) }).catch(() => undefined); accessToken = null; currentUser = null; localStorage.removeItem(ACCESS_TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); publish(false); },
  login: async () => undefined,
  sendPasswordResetEmail: (email: string) => authRequest('/recover', { email }),
};

export const blink: any = { auth, db: createPostgresDb(() => auth.getValidToken()), realtime: { subscribe: async () => () => undefined } };
export const INVENTORY_CHANNEL = 'inventory-updates';
export const INVENTORY_UPDATED_EVENT = 'updated';
export const BATTLE_CHANNEL_PREFIX = 'battle-state';
export const BATTLE_LOBBY_CHANNEL = 'battle-lobby';
export const BATTLE_EVENTS = { PHASE_CHANGE: 'phase_change', ROUND_UPDATE: 'round_update', SPIN_TOGGLE: 'spin_toggle', BATTLE_FINISHED: 'battle_finished', RESULTS_READY: 'results_ready', COUNTDOWN_UPDATE: 'countdown_update', BATTLE_CANCELED: 'battle_canceled' };
void refreshUser();