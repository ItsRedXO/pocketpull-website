import { blink } from './blink';

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

export async function fetchRailwayInventory(): Promise<RailwayInventoryRow[]> {
  const token = await blink.auth.getValidToken();
  const response = await fetch('/api/inventory', {
    method: 'GET',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Failed to load inventory (${response.status})`);
  return Array.isArray(data) ? data : [];
}
