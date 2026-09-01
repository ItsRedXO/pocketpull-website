import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { BALANCE_QUERY_KEY, type BalanceData } from './useBalance';
import { bootstrapUser, fetchCurrentUser, resolveLoginIdentifier, validateSignup } from '../lib/userApi';

export interface PocketPullUser {
  id: string;
  email?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<PocketPullUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUser = useCallback(async (authUser: any) => {
    if (!authUser?.id && !authUser?.uid) return;
    const id = authUser.id || authUser.uid;
    try {
      const result = await bootstrapUser({ email: authUser.email, username: authUser.username, displayName: authUser.displayName || authUser.display_name, avatarUrl: authUser.avatarUrl || authUser.avatar_url, referralCode: localStorage.getItem('pending_referral_code') || undefined });
      if (result.user) setUser(result.user);
      localStorage.removeItem('pending_referral_code');
    } catch (err) {
      try { const result = await fetchCurrentUser(); if (result.user) setUser(result.user); } catch { setUser({ id, email: authUser.email, displayName: authUser.displayName, username: authUser.username, avatarUrl: authUser.avatarUrl }); }
    }
  }, []);

  useEffect(() => {
    let resolved = false;
    const unsubscribe = blink.auth.onAuthStateChanged((state: any) => {
      if (state.isLoading) return;
      resolved = true;
      if (state.user) { void syncUser(state.user); }
      else setUser(null);
      setIsLoading(false);
    });
    const fallback = window.setTimeout(() => { if (!resolved) setIsLoading(false); }, 5000);
    return () => { window.clearTimeout(fallback); unsubscribe(); };
  }, [syncUser]);

  const signIn = async (emailOrUsername: string, password: string) => {
    const trimmed = emailOrUsername.trim();
    const email = trimmed.includes('@') ? trimmed : await resolveLoginIdentifier(trimmed);
    const result = await blink.auth.signInWithEmail(email, password);
    await syncUser((result as any)?.user || (blink.auth as any).currentUser);
    return result;
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();
    await validateSignup(trimmedEmail, trimmedUsername);
    if (referralCode) localStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
    const result = await blink.auth.signUp({ email: trimmedEmail, password, displayName: trimmedUsername });
    await syncUser((result as any)?.user || (blink.auth as any).currentUser);
    return result;
  };

  const signOut = async () => { await blink.auth.signOut(); setUser(null); };
  const login = () => blink.auth.login();
  const logout = signOut;
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

export function useUserStats(userId?: string, userEmail?: string, userDisplayName?: string, _isEmailVerified?: boolean) {
  const qc = useQueryClient();
  const { data: stats = null, isLoading: loading, refetch } = useQuery<UserStats | null>({
    queryKey: [...USER_STATS_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const result = await fetchCurrentUser();
      const u = result.user;
      if (!u) return null;
      return { balance:Number(u.balance||0), matchedBalance:Number(u.matchedBalance||0), displayName:u.displayName||u.username||userDisplayName||'Trainer', avatarUrl:u.avatarUrl||'', email:u.email||userEmail||'', username:u.username||u.displayName||'Trainer', emailVerified:true, role:u.role||'user', isBanned:Boolean(u.isBanned), isDeleted:Boolean(u.isDeleted), referralCode:u.referralCode||'' };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const updateBalance = async (newBalance: number) => {
    if (!userId) return;
    qc.setQueryData([...USER_STATS_QUERY_KEY,userId], (prev: UserStats|null) => prev ? {...prev,balance:newBalance} : prev);
    qc.setQueryData([...BALANCE_QUERY_KEY,userId], (prev: BalanceData|undefined) => prev ? {...prev,balance:newBalance} : {balance:newBalance,matchedBalance:0});
    await refetch();
  };

  const updateProfile = async (updates: {displayName?:string;avatarUrl?:string;email?:string;username?:string}) => {
    const token = await blink.auth.getValidToken();
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/me/profile`, { method:'PATCH', headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:JSON.stringify(updates) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to update profile');
    qc.setQueryData([...USER_STATS_QUERY_KEY,userId], data.user);
    return data.user;
  };

  const setStats = useCallback((newStats: UserStats | null) => qc.setQueryData([...USER_STATS_QUERY_KEY,userId], newStats), [qc,userId]);
  return { stats, loading, updateBalance, updateProfile, setStats, refetch };
}
