import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { startOfDay } from 'date-fns';
import { getDailyIncrementalValue, getDailySeed, seededRandom } from '../lib/simulation';
import { getLeaderboardData } from '../lib/leaderboard';

/**
 * Hook to manage global live counters for the hero section and platform activity.
 * - Packs Opened Today: Deterministic time-based curve (40k–80k/day), computed server-side.
 *     Resets at midnight Pacific. Only ever increases.
 * - Cards Won Today: Targeted ~10,000/day, resets at midnight
 * - Biggest Pull Today: Synchronized with #1 on leaderboard
 * - Live Players: Simulated 150-250 (fluctuating) + real presence count
 * - Total Upgrades: Targeted ~5,000/day, resets at midnight
 * - Exchanges Today: Targeted ~3,000/day, resets at midnight
 */
export function useLiveCounters() {
  // Track previous value so the counter only ever goes up within a session
  const packsOpenedRef = useRef(0);
  const lastDateRef = useRef('');

  // Reset the monotonic ref when the Pacific date changes
  const todayPacific = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  if (lastDateRef.current && lastDateRef.current !== todayPacific) {
    packsOpenedRef.current = 0;
  }
  lastDateRef.current = todayPacific;

  // 1. Packs Opened & Live Battles (Centralized backend source, fast polling)
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

  const rawPacksOpened = backendStats?.packsOpened ?? 0;
  // Only ever go up within a day; day-reset handled above
  if (rawPacksOpened > packsOpenedRef.current) {
    packsOpenedRef.current = rawPacksOpened;
  }
  const packsOpened = packsOpenedRef.current;
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
    const seed = startOfDay(new Date()).getTime();
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
    // Presence is a protected realtime read. Do not open the channel on the
    // public landing page before managed/headless auth has resolved; otherwise
    // the SDK emits an avoidable 401 and browsers report it as Failed to fetch.
    let channel: ReturnType<typeof blink.realtime.channel> | null = null;
    let unsubscribeAuth: (() => void) | undefined;
    const initPresence = async () => {
      if (!blink.auth.isAuthenticated()) return;
      channel = blink.realtime.channel('app-presence');
      try {
        await channel.subscribe();
        channel.onPresence((users) => {
          setRealPlayers(users.length);
        });
        const initial = await channel.getPresence();
        setRealPlayers(initial.length);
      } catch {
        // Simulated players remain available when realtime is unavailable.
      }
    };

    unsubscribeAuth = blink.auth.onAuthStateChanged((state) => {
      if (!state.isLoading) void initPresence();
    });

    // Fluctuate simulated players every 15 seconds
    const interval = setInterval(() => {
      setSimulatedOffset(prev => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
        const next = prev + delta;
        return Math.min(250, Math.max(150, next));
      });
    }, 15000);

    return () => {
      unsubscribeAuth?.();
      void channel?.unsubscribe();
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
