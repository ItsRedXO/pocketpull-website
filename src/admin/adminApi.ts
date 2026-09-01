import { blink } from '../lib/blink';

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'https://b2nnhe2n.backend.blink.new';

async function headers() {
  const token = await blink.auth.getValidToken().catch(() => null);
  const adminPass = localStorage.getItem('pocketpull_admin_pass');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(adminPass ? { 'X-Admin-Password': adminPass } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { ...init, headers: { ...(await headers()), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}

export const adminPacksApi = {
  list: () => request<{ packs: any[]; cards: any[] }>('/admin/packs'),
  save: (pack: any, cards: any[]) => request<{ success: boolean }>('/admin/packs', { method: 'POST', body: JSON.stringify({ pack, cards }) }),
  update: (id: string, patch: any) => request<{ success: boolean }>(`/admin/packs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => request<{ success: boolean }>(`/admin/packs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
