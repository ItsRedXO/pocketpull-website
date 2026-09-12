import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { realtime } from '../lib/realtime';
import { getDailyIncrementalValue } from '../lib/simulation';
import { startOfDayInZone } from '../lib/dailyReset';
import { getLeaderboardData } from '../lib/leaderboard';
import { useSiteSimulationSettings } from './useSiteSimulationSettings';
import { getSimulatedLivePlayers } from '../lib/livePlayers';

/**
 * Hook to manage global live counters for the hero section and platform activity.
 * - Packs Opened Today: Deterministic time-based curve, computed locally (see
 *     getDailyIncrementalValue) so the range is exact and verifiable. Ramps
 *     from the admin-set min toward *today's* specific target -- a value
 *     auto-rolled once per Pacific calendar day within [min,max] (or pinned
 *     by an admin), so different days actually land on different totals
 *     instead of every day climbing to the same fixed ceiling. See
 *     useSiteSimulationSettings / the admin panel's Site Settings tab.
 *     Resets at midnight Pacific. Only ever increases within a day.
 * - Cards Won Today: Same admin-adjustable range + per-day target as above.
 * - Biggest Pull Today: Synchronized with #1 on leaderboard (itself capped at
 *     the real catalog's highest card value -- see leaderboard.ts).
 * - Live Players: Admin-adjustable range, simulated with a day/night curve
 *     (see lib/livePlayers.ts) + real presence count.
 * - Total Upgrades: Targeted ~5,000/day, resets at midnight Pacific.
 * - Exchanges Today: Targeted ~3,000/day, resets at midnight Pacific.
 */
export function useLiveCounters() {
  const settings = useSiteSimulationSettings();

  // 1. Packs Opened (local deterministic curve; re-sampled periodically so it
  // still visibly ticks up like a live counter without any network call).
  // Ramps toward *today's* specific target (auto-rolled per day within
  // [min,max], or admin-pinned) rather than always climbing to the same max.
  const [packsOpened, setPacksOpened] = useState(() => getDailyIncrementalValue(settings.packsOpenedMin, settings.packsOpenedTodayTarget - settings.packsOpenedMin));
  useEffect(() => {
    const recompute = () => setPacksOpened(getDailyIncrementalValue(settings.packsOpenedMin, settings.packsOpenedTodayTarget - settings.packsOpenedMin));
    recompute();
    const interval = setInterval(recompute, 5000);
    return () => clearInterval(interval);
  }, [settings.packsOpenedMin, settings.packsOpenedTodayTarget]);

  // Live Battles (real count from the centralized battle-stats endpoint, kept
  // as-is -- only packsOpened from this source was inaccurate/unpredictable).
  const { data: backendStats } = useQuery({
    queryKey: ['battle-stats-centralized'],
    queryFn: async () => {
      const res = await fetch('https://b2nnhe2n.backend.blink.new/battles/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<{ liveBattles: number, packsOpened: number }>;
    },
    refetchInterval: 3000, // fast polling for smooth live counter
    staleTime: 1000,
    retry: false,
  });

  const realLiveBattles = backendStats?.liveBattles || 0;

  // Simulate active battles count to keep community section feeling alive
  const simulatedBattlesCount = useMemo(() => {
    const hour = new Date().getHours();
    return 8 + (hour % 6); // Matches useSimulatedBattles initial count logic
  }, []);

  const liveBattles = realLiveBattles + simulatedBattlesCount;

  // 2. Cards Won Today (admin-adjustable range, resets at midnight; ramps
  // toward today's specific auto-rolled/pinned target, same as Packs Opened).
  const cardsWonToday = useMemo(() => {
    return getDailyIncrementalValue(settings.cardsWonMin, settings.cardsWonTodayTarget - settings.cardsWonMin);
  }, [settings.cardsWonMin, settings.cardsWonTodayTarget]);

  // 3. Total Upgrades Today (Targets ~5,000/day)
  const totalUpgrades = useMemo(() => {
    return getDailyIncrementalValue(180, 5000);
  }, []);

  // 4. Exchanges Today (Targets ~3,000/day)
  const exchangesToday = useMemo(() => {
    return getDailyIncrementalValue(110, 3000);
  }, []);

  // 5. Average Pull Value (Fluctuating around $120)
  const avgPullValue = useMemo(() => {
    const seed = startOfDayInZone(new Date()).getTime();
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const fluctuation = Math.sin(seed + hour + minute) * 15;
    return Math.floor(115 + fluctuation);
  }, []);

  // 6. Biggest Pull All-Time (Synchronized with #1 on leaderboard)
  const { data: biggestPull = 0 } = useQuery({
    queryKey: ['biggest-pull-sync'],
    queryFn: async () => {
      const pulls = await getLeaderboardData('pulls');
      return pulls[0]?.numericValue || 0;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  // 7. Live Players Online (Simulated + Real)
  const [realPlayers, setRealPlayers] = useState(0);

  useEffect(() => {
    const presenceChannel = realtime.channel('app-presence');
    const initPresence = async () => {
      try {
        await presenceChannel.subscribe();
        presenceChannel.onPresence((users) => {
          setRealPlayers(users.length);
        });
        const initial = await presenceChannel.getPresence();
        setRealPlayers(initial.length);
      } catch {
        // Simulated players remain available when realtime is unavailable.
      }
    };
    void initPresence();
    return () => { void presenceChannel.unsubscribe(); };
  }, []);

  // Simulated player count: a continuous day/night curve within the
  // admin-set range (see lib/livePlayers.ts), re-sampled periodically.
  const [simulatedPlayers, setSimulatedPlayers] = useState(() => getSimulatedLivePlayers(settings.livePlayersMin, settings.livePlayersMax));
  useEffect(() => {
    const recompute = () => setSimulatedPlayers(getSimulatedLivePlayers(settings.livePlayersMin, settings.livePlayersMax));
    recompute();
    const interval = setInterval(recompute, 8000);
    return () => clearInterval(interval);
  }, [settings.livePlayersMin, settings.livePlayersMax]);

  return {
    packsOpened,
    cardsWonToday,
    totalUpgrades,
    exchangesToday,
    avgPullValue,
    biggestPull,
    livePlayers: simulatedPlayers + realPlayers,
    liveBattles
  };
}
