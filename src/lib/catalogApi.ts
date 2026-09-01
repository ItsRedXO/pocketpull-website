import { blink } from './blink';

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'https://b2nnhe2n.backend.blink.new';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await blink.auth.getValidToken().catch(() => null);
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}

export const catalogApi = {
  packs: () => request<{ packs: any[] }>('/catalog/packs'),
  cards: (packId: string) => request<{ cards: any[] }>(`/catalog/packs/${encodeURIComponent(packId)}/cards`),
  cooldowns: () => request<{ cooldowns: any[] }>('/catalog/cooldowns'),
};
