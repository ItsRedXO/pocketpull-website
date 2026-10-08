import { BACKEND_BASE } from '../lib/backend';
import type { SiteSimulationSettings } from '../hooks/useSiteSimulationSettings';
import { getAdminAuthHeaders } from './adminAuthHeaders';

async function adminHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json', ...await getAdminAuthHeaders() };
}

export const fetchSiteSettings = async (): Promise<SiteSimulationSettings> => {
  const res = await fetch(`${BACKEND_BASE}/site-settings`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as SiteSimulationSettings;
};

export interface SiteSettingsPatchInput {
  packsOpenedMin?: number;
  packsOpenedMax?: number;
  cardsWonMin?: number;
  cardsWonMax?: number;
  livePlayersMin?: number;
  livePlayersMax?: number;
  /** Pin today's Packs Opened total to an exact number; null clears the pin (reverts to the auto daily roll). */
  packsOpenedTodayOverride?: number | null;
  /** Pin today's Cards Won total to an exact number; null clears the pin (reverts to the auto daily roll). */
  cardsWonTodayOverride?: number | null;
}

export const patchSiteSettings = async (fields: SiteSettingsPatchInput) => {
  const res = await fetch(`${BACKEND_BASE}/admin/site-settings`, {
    method: 'PATCH',
    headers: await adminHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as { success: boolean; settings: SiteSimulationSettings };
};
