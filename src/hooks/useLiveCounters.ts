import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { realtime } from '../lib/realtime';
import { getDailyIncrementalValue } from '../lib/simulation';
import { startOfDayInZone } from '../lib/dailyReset';
import { getLeaderboardData } from '../lib/leaderboard';

/**
 * Hook to manage global live counters for the hero section and platform activity.
 * - Packs Opened Today: Deterministic time-based curve (40k-80k/day), computed
 *     locally (see getDailyIncrementalValue) so the range is exact and
 *     verifiable -- previously sourced from a legacy external endpoint whose
 *     actual output drifted well outside its own documented range.
 *     Resets at midnight Pacific. Only ever increases within a day.
 * - Cards Won Today: Targeted ~10,000/day, resets at midnight Pacific.
 * - Biggest Pull Today: Synchronized with #1 on leaderboard (itself capped at
 *     the real catalog's highest card value -- see leaderboard.ts).
 * - Live Players: Simulated 150-250 (fluctuating) + real presence count.
 * - Total Upgrades: Targeted ~5,000/day, resets at midnight Pacific.
 * - Exchanges Today: Targeted ~3,000/day, resets at midnight Pacific.
 */
export function useLiveCounters() {
  // 1. Packs Opened (local deterministic curve; re-sampled periodically so it
  // still visibly ticks up like a live counter without any network call).
  const [packsOpened, setPacksOpened] = useState(() => getDailyIncrementalValue(40000, 40000));
  useEffect(() => {
    const interval = setInterval(() => setPacksOpened(getDailyIncrementalValue(40000, 40000)), 5000);
    return () => clearInterval(interval);
  }, []);

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

  // 2. Cards Won Today (Targets ~10,000/day, resets at midnight)
  const cardsWonToday = useMemo(() => {
    return getDailyIncrementalValue(420, 10000);
  }, []);

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
  const [simulatedOffset, setSimulatedOffset] = useState(180);

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

    // Fluctuate simulated players every 15 seconds
    const interval = setInterval(() => {
      setSimulatedOffset(prev => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
        const next = prev + delta;
        return Math.min(250, Math.max(150, next));
      });
    }, 15000);

    return () => {
      void presenceChannel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    packsOpened,
    cardsWonToday,
    totalUpgrades,
    exchangesToday,
    avgPullValue,
    biggestPull,
    livePlayers: simulatedOffset + realPlayers,
    liveBattles
  };
}
