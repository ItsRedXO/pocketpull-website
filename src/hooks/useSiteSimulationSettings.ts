import { useQuery } from '@tanstack/react-query';
import { BACKEND_BASE } from '../lib/backend';

export interface SiteSimulationSettings {
  packsOpenedMin: number;
  packsOpenedMax: number;
  /** The specific number Packs Opened will land on by the end of today (Pacific). */
  packsOpenedTodayTarget: number;
  /** True if an admin pinned today's target; false if it was auto-rolled. */
  packsOpenedTodayOverridden: boolean;
  cardsWonMin: number;
  cardsWonMax: number;
  /** The specific number Cards Won will land on by the end of today (Pacific). */
  cardsWonTodayTarget: number;
  /** True if an admin pinned today's target; false if it was auto-rolled. */
  cardsWonTodayOverridden: boolean;
  livePlayersMin: number;
  livePlayersMax: number;
}

export const DEFAULT_SITE_SIMULATION_SETTINGS: SiteSimulationSettings = {
  packsOpenedMin: 40000, packsOpenedMax: 80000, packsOpenedTodayTarget: 80000, packsOpenedTodayOverridden: false,
  cardsWonMin: 420, cardsWonMax: 10420, cardsWonTodayTarget: 10420, cardsWonTodayOverridden: false,
  livePlayersMin: 150, livePlayersMax: 250,
};

/**
 * Admin-configurable ranges (and today's specific rolled/pinned target) for
 * the homepage's simulated "live" numbers. Public, unauthenticated read --
 * these are display ranges, not secrets. Falls back to the shipped defaults
 * if the request fails so the homepage never blanks out because this one
 * endpoint is briefly unavailable.
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
