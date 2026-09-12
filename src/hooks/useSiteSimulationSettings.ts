import { useQuery } from '@tanstack/react-query';
import { BACKEND_BASE } from '../lib/backend';

export interface SiteSimulationSettings {
  packsOpenedMin: number;
  packsOpenedMax: number;
  cardsWonMin: number;
  cardsWonMax: number;
  livePlayersMin: number;
  livePlayersMax: number;
}

export const DEFAULT_SITE_SIMULATION_SETTINGS: SiteSimulationSettings = {
  packsOpenedMin: 40000, packsOpenedMax: 80000,
  cardsWonMin: 420, cardsWonMax: 10420,
  livePlayersMin: 150, livePlayersMax: 250,
};

/**
 * Admin-configurable ranges for the homepage's simulated "live" numbers.
 * Public, unauthenticated read -- these are display ranges, not secrets.
 * Falls back to the shipped defaults if the request fails so the homepage
 * never blanks out because this one endpoint is briefly unavailable.
 */
export function useSiteSimulationSettings(): SiteSimulationSettings {
  const { data } = useQuery({
    queryKey: ['site-simulation-settings'],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_BASE}/site-settings`);
      if (!res.ok) throw new Error('Failed to load site settings');
      return res.json() as Promise<SiteSimulationSettings>;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
  return data ?? DEFAULT_SITE_SIMULATION_SETTINGS;
}
