import { BACKEND_BASE } from './backend';

export interface RailwayInventoryRow {
  id: string;
  cardId?: string;
  card_id?: string;
  cardName?: string;
  card_name?: string;
  rarity?: string;
  value?: number | string;
  emoji?: string;
  locked?: number;
  is_locked?: number;
  favorite?: number;
  is_favorite?: number;
  sold?: number;
  cardImageUrl?: string | null;
  card_image_url?: string | null;
  packName?: string | null;
  pack_name?: string | null;
  createdAt?: string;
  created_at?: string;
}

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const candidates = [
    'supabase.auth.token',
    'supabase.auth.session',
    'pocketpull_access_token',
  ];
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      if (raw.startsWith('ey')) return raw;
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      if (token) return token;
    } catch {}
  }
  return null;
}

export async function fetchRailwayInventory(): Promise<RailwayInventoryRow[]> {
  const token = getStoredAccessToken();
  const response = await fetch(`${BACKEND_BASE}/inventory`, {
    method: 'GET',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Failed to load inventory (${response.status})`);
  return Array.isArray(data) ? data : Array.isArray(data?.inventory) ? data.inventory : [];
}
