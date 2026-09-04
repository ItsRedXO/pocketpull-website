import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { BALANCE_QUERY_KEY, type BalanceData } from './useBalance';

type AuthUser = { id: string; email?: string; displayName?: string; emailVerified?: boolean; [key: string]: unknown };

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state: { user: AuthUser | null; isLoading: boolean }) => {
      if (state.isLoading) return;
      setUser(state.user);
      setIsLoading(false);
    });
    const fallback = window.setTimeout(() => setIsLoading(false), 5000);
    return () => { window.clearTimeout(fallback); unsubscribe(); };
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    const identifier = emailOrUsername.trim();
    if (!identifier || !password) throw new Error('INVALID_CREDENTIALS');
    // Username resolution and authentication are handled by the Supabase-backed auth adapter.
    // Do not query the protected database before a session exists.
    return blink.auth.signInWithEmail(identifier, password);
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();
    if (referralCode) localStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
    return blink.auth.signUp({ email: trimmedEmail, password, displayName: trimmedUsername });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut: () => blink.auth.signOut(),
    login: () => blink.auth.login(),
    logout: () => blink.auth.signOut(),
    sendPasswordReset: (email: string) => blink.auth.sendPasswordResetEmail(email),
  };
}

export interface UserStats {
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

export const USER_STATS_QUERY_KEY = ['user-stats'];

export function useUserStats(userId?: string, userEmail?: string, userDisplayName?: string, isEmailVerified?: boolean) {
  const qc = useQueryClient();
  const { data: stats = null, isLoading: loading, refetch } = useQuery<UserStats | null>({
    queryKey: [...USER_STATS_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const userRow = await blink.db.users.get(userId);
      if (userRow) {
        return {
          balance: Number((userRow as any).balance) || 0,
          matchedBalance: Number((userRow as any).matchedBalance ?? (userRow as any).matched_balance) || 0,
          displayName: String((userRow as any).displayName || (userRow as any).username || userDisplayName || 'Trainer'),
          avatarUrl: String((userRow as any).avatarUrl || ''),
          email: String((userRow as any).email || userEmail || ''),
          username: String((userRow as any).username || (userRow as any).displayName || 'Trainer'),
          emailVerified: Number((userRow as any).emailVerified ?? (userRow as any).email_verified) > 0 || !!isEmailVerified,
          role: String((userRow as any).role || ''),
          isBanned: Number((userRow as any).isBanned ?? (userRow as any).is_banned) > 0,
          isDeleted: Number((userRow as any).isDeleted ?? (userRow as any).is_deleted) > 0,
          referralCode: String((userRow as any).referralCode || ''),
        };
      }
      const displayName = userDisplayName || `Trainer_${userId.slice(-4)}`;
      const referralCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      await blink.db.users.create({ id: userId, balance: 0, matchedBalance: 0, displayName, username: displayName, email: userEmail || '', avatarUrl: '', emailVerified: 1, role: '', isBanned: false, isDeleted: false, referralCode, referralRewardPaid: false }).catch((error: any) => { if (error?.status !== 409) throw error; });
      return { balance: 0, matchedBalance: 0, displayName, avatarUrl: '', email: userEmail || '', username: displayName, emailVerified: true, role: '', isBanned: false, isDeleted: false, referralCode };
    },
    staleTime: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
  });

  const updateBalance = async (newBalance: number) => {
    if (!userId) return;
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => prev ? { ...prev, balance: newBalance } : prev);
    qc.setQueryData([...BALANCE_QUERY_KEY, userId], (prev: BalanceData | undefined) => prev ? { ...prev, balance: newBalance } : { balance: newBalance, matchedBalance: 0 });
    await qc.invalidateQueries({ queryKey: [...USER_STATS_QUERY_KEY, userId] });
    await qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });
  };

  const updateProfile = async (updates: { displayName?: string; avatarUrl?: string; email?: string; username?: string }) => {
    if (!userId) return;
    await blink.db.users.update(userId, updates);
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => prev ? { ...prev, ...updates } : prev);
  };

  const setStats = useCallback((newStats: UserStats | null) => qc.setQueryData([...USER_STATS_QUERY_KEY, userId], newStats), [qc, userId]);
  return { stats, loading, updateBalance, updateProfile, setStats, refetch };
}