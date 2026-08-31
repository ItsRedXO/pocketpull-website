import { useQuery } from '@tanstack/react-query';
import { getLeaderboardData, LeaderboardEntry } from '../lib/leaderboard';

export type { LeaderboardEntry };

export const LEADERBOARD_QUERY_KEY = ['leaderboard'];

export function useLeaderboard() {
  const pulls = useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, 'pulls'],
    queryFn: () => getLeaderboardData('pulls'),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const packs = useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, 'packs'],
    queryFn: () => getLeaderboardData('packs'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const upgrades = useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, 'upgrades'],
    queryFn: () => getLeaderboardData('upgrades'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return {
    pulls: pulls.data || [],
    packs: packs.data || [],
    upgrades: upgrades.data || [],
    isLoading: pulls.isLoading || packs.isLoading || upgrades.isLoading
  };
}
