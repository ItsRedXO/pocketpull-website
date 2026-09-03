import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { BALANCE_REFRESH_INTERVAL_MS } from './balanceRefresh';

// Keep in sync with useAuth.ts — avoid circular import
const USER_STATS_QUERY_KEY = ['user-stats'];
interface UserStats {
  balance: number;
  matchedBalance: number;
  displayName: string;
  avatarUrl: string;
  email: string;
  username: string;
  emailVerified: boolean;
  role: string;
  isBanned: boolean;
  isDeleted: boolean;
  referralCode: string;
}

export const BALANCE_QUERY_KEY = ['user-balance'];

export interface BalanceData {
  balance: number;
  matchedBalance: number;
}

export function useBalance(userId?: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BalanceData>({
    queryKey: [...BALANCE_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { balance: 0, matchedBalance: 0 };
      const row = await blink.db.users.get(userId) as any;
      return {
        balance: Number(row?.balance) || 0,
        matchedBalance: Number(row?.matchedBalance || row?.matched_balance || 0) || 0,
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    retry: 2,
    retryDelay: attempt => Math.min(750 * 2 ** attempt, 3000),
    // Realtime updates remain the fast path. This silent foreground fallback
    // catches admin credit changes and missed realtime events within ~3 seconds.
    refetchInterval: BALANCE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId) return;
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const subscribeToBalance = async () => {
      try {
        unsubscribe = await blink.realtime.subscribe(`user-updates-${userId}`, (message) => {
          if (!active || message.type !== 'balance_updated') return;
          const nextBalance = Number(message.data?.newBalance) || 0;
          const nextMatchedBalance = Number(message.data?.newMatchedBalance);
          qc.setQueryData([...BALANCE_QUERY_KEY, userId], (previous: BalanceData | undefined) => ({
            balance: nextBalance,
            matchedBalance: Number.isFinite(nextMatchedBalance)
              ? nextMatchedBalance
              : previous?.matchedBalance || 0,
          }));
        });
      } catch (error) {
        console.warn('[useBalance] Realtime subscription failed:', error);
      }
    };

    subscribeToBalance();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [qc, userId]);

  // Canonical balance update — sets cache immediately, then confirms via DB
  const updateBalance = async (newBalance: number) => {
    if (!userId) return;
    // Update BALANCE_QUERY_KEY
    qc.setQueryData([...BALANCE_QUERY_KEY, userId], (prev: BalanceData | undefined) =>
      prev ? { ...prev, balance: newBalance } : { balance: newBalance, matchedBalance: 0 }
    );
    // Also update USER_STATS_QUERY_KEY so both caches stay in sync
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) =>
      prev ? { ...prev, balance: newBalance } : null
    );
    // Force all observers to confirm via DB refetch — guarantees Navbar and all
    // balance displays pick up the new value immediately
    qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });
    qc.invalidateQueries({ queryKey: [...USER_STATS_QUERY_KEY, userId] });
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });

  return {
    balance: data?.balance ?? 0,
    matchedBalance: data?.matchedBalance ?? 0,
    isLoading,
    updateBalance,
    invalidate,
  };
}
