import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import type { BlinkUser } from '@blinkdotnew/sdk';
import { BALANCE_QUERY_KEY, type BalanceData } from './useBalance';

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'https://b2nnhe2n.backend.blink.new';

async function api(path: string, init: RequestInit = {}) {
  const token = await blink.auth.getValidToken();
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export function useAuth() {
  const [user, setUser] = useState<BlinkUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let authResolved = false;
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      if (state.isLoading) return;
      authResolved = true;
      setUser(state.user);
      setIsLoading(false);
    });
    const fallback = window.setTimeout(() => { if (!authResolved) setIsLoading(false); }, 5000);
    return () => { window.clearTimeout(fallback); unsubscribe(); };
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    const identifier = emailOrUsername.trim();
    if (!identifier) throw new Error('INVALID_CREDENTIALS');
    let loginEmail = identifier;
    if (!identifier.includes('@')) {
      const result = await fetch(`${BACKEND_BASE}/auth/resolve-login?identifier=${encodeURIComponent(identifier)}`);
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data?.error || 'INVALID_CREDENTIALS');
      loginEmail = data.email;
    } else {
      const result = await fetch(`${BACKEND_BASE}/auth/resolve-login?identifier=${encodeURIComponent(identifier.toLowerCase())}`);
      const data = await result.json().catch(() => ({}));
      if (!result.ok && data?.error !== 'INVALID_CREDENTIALS') throw new Error(data?.error || 'INVALID_CREDENTIALS');
    }
    return blink.auth.signInWithEmail(loginEmail, password);
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const result = await fetch(`${BACKEND_BASE}/auth/check-signup?email=${encodeURIComponent(trimmedEmail)}&username=${encodeURIComponent(trimmedUsername)}`);
    const data = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(data?.error || 'SIGNUP_CHECK_FAILED');
    if (referralCode) localStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
    return blink.auth.signUp({ email: trimmedEmail, password, displayName: trimmedUsername });
  };

  const signOut = async () => blink.auth.signOut();
  const login = () => blink.auth.login();
  const logout = () => blink.auth.signOut();
  const sendPasswordReset = async (email: string) => blink.auth.sendPasswordResetEmail(email);

  return { user, isLoading, isAuthenticated: !!user, signIn, signUp, signOut, login, logout, sendPasswordReset };
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
      const { user: row } = await api('/me');
      return {
        balance: Number(row?.balance) || 0,
        matchedBalance: Number(row?.matchedBalance ?? row?.matched_balance ?? 0) || 0,
        displayName: row?.displayName || row?.username || userDisplayName || 'Trainer',
        avatarUrl: row?.avatarUrl || '',
        email: row?.email || userEmail || '',
        username: row?.username || row?.displayName || 'Trainer',
        emailVerified: Number(row?.emailVerified ?? row?.email_verified ?? 0) > 0,
        role: row?.role || '',
        isBanned: Number(row?.isBanned ?? row?.is_banned ?? 0) > 0,
        isDeleted: Number(row?.isDeleted ?? row?.is_deleted ?? 0) > 0,
        referralCode: row?.referralCode || '',
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attempt => Math.min(750 * 2 ** attempt, 3000),
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
    const { user } = await api('/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => prev ? { ...prev, ...updates } : prev);
    return user;
  };

  const setStats = useCallback((newStats: UserStats | null) => qc.setQueryData([...USER_STATS_QUERY_KEY, userId], newStats), [qc, userId]);
  return { stats, loading, updateBalance, updateProfile, setStats, refetch };
}
