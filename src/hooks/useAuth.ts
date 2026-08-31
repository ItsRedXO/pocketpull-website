import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import type { BlinkUser } from '@blinkdotnew/sdk';
import { BALANCE_QUERY_KEY, type BalanceData } from './useBalance';

export function useAuth() {
  const [user, setUser] = useState<BlinkUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let authResolved = false;

    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      // Do not publish a transient signed-out state while the SDK is resolving.
      // Every later settled event must still be accepted so sign-in can update
      // the navbar after the initial fallback has fired.
      if (state.isLoading) return;
      authResolved = true;
      setUser(state.user);
      setIsLoading(false);
    });

    // Never leave the public navbar blocked forever if the provider callback is
    // delayed. This only releases the loading UI; it does not publish null, so
    // a later authenticated event cannot be lost.
    const fallback = window.setTimeout(() => {
      if (!authResolved) setIsLoading(false);
    }, 5000);

    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  // ── Email OR username login ──────────────────────────────────────────────────
  const signIn = async (emailOrUsername: string, password: string) => {
    const trimmed = emailOrUsername.trim();

    let loginEmail = trimmed;

    if (!trimmed.includes('@')) {
      // Username → look up email
      const rows = await blink.db.users.list({ where: { username: trimmed }, limit: 1 });
      if (!rows || rows.length === 0) throw new Error('INVALID_CREDENTIALS');
      const email = rows[0].email as string;
      if (!email) throw new Error('INVALID_CREDENTIALS');
      loginEmail = email;

      // Check ban status by username row
      const userRow = rows[0] as any;
      if (Number(userRow.isBanned || userRow.is_banned) > 0) {
        throw new Error('BANNED_ACCOUNT');
      }
      if (Number(userRow.isDeleted || userRow.is_deleted) > 0) {
        // Deleted users have their email wiped — their auth record should also be gone,
        // but just in case, block them.
        throw new Error('INVALID_CREDENTIALS');
      }
    } else {
      // Email login — check ban/delete status before attempting auth
      // Look up by email (only non-deleted rows — deleted rows have email nulled/prefixed)
      const emailRows = await blink.db.users.list({ where: { email: trimmed }, limit: 1 });
      if (emailRows && emailRows.length > 0) {
        const userRow = emailRows[0] as any;
        if (Number(userRow.isBanned || userRow.is_banned) > 0) {
          throw new Error('BANNED_ACCOUNT');
        }
        // isDeleted with matching email means the delete didn't wipe the email yet — still block
        if (Number(userRow.isDeleted || userRow.is_deleted) > 0) {
          throw new Error('INVALID_CREDENTIALS');
        }
      }
    }

    return blink.auth.signInWithEmail(loginEmail, password);
  };

  // ── Sign up with unique-username enforcement ────────────────────────────────
  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Check if this email belongs to a BANNED account (block new signup with banned email)
    const emailRows = await blink.db.users.list({ where: { email: trimmedEmail }, limit: 5 });
    if (emailRows && emailRows.length > 0) {
      for (const row of emailRows as any[]) {
        // Skip deleted users — their email was released (wiped)
        if (Number(row.isDeleted || row.is_deleted) > 0) continue;
        // If any active/banned row has this email and is banned → block signup
        if (Number(row.isBanned || row.is_banned) > 0) {
          throw new Error('EMAIL_BANNED');
        }
      }
    }

    // Username uniqueness — only check non-deleted users
    const existing = await blink.db.users.list({ where: { username: trimmedUsername }, limit: 5 });
    if (existing && existing.length > 0) {
      const activeMatch = (existing as any[]).find(r => Number(r.isDeleted || r.is_deleted) === 0);
      if (activeMatch) throw new Error('USERNAME_TAKEN');
    }

    const existingDisplay = await blink.db.users.list({ where: { displayName: trimmedUsername }, limit: 5 });
    if (existingDisplay && existingDisplay.length > 0) {
      const activeMatch = (existingDisplay as any[]).find(r => Number(r.isDeleted || r.is_deleted) === 0);
      if (activeMatch) throw new Error('USERNAME_TAKEN');
    }

    if (referralCode) {
      localStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
    }

    return blink.auth.signUp({ email: trimmedEmail, password, displayName: trimmedUsername });
  };

  const signOut = async () => blink.auth.signOut();
  const login = () => blink.auth.login();
  const logout = () => blink.auth.signOut();
  const sendPasswordReset = async (email: string) => blink.auth.sendPasswordResetEmail(email);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    login,
    logout,
    sendPasswordReset,
  };
}

// ── Stats shape includes role ───────────────────────────────────────────────────
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
      try {
        const userRow = await blink.db.users.get(userId);
        if (userRow) {
          const statsData: UserStats = {
            balance: Number(userRow.balance) || 0,
            matchedBalance: Number(userRow.matchedBalance || userRow.matched_balance || 0) || 0,
            displayName: (userRow.displayName as string) || (userRow.username as string) || userDisplayName || 'Trainer',
            avatarUrl: (userRow.avatarUrl as string) || '',
            email: (userRow.email as string) || userEmail || '',
            username: (userRow.username as string) || (userRow.displayName as string) || 'Trainer',
            emailVerified: Number(userRow.emailVerified || userRow.email_verified) > 0,
            role: (userRow.role as string) || '',
            isBanned: Number(userRow.isBanned || userRow.is_banned) > 0,
            isDeleted: Number(userRow.isDeleted || userRow.is_deleted) > 0,
            referralCode: (userRow.referralCode as string) || '',
          };

          void Promise.resolve().then(async () => {
            // Secondary profile initialization must never delay the navbar.
            // Backfill email / username / referralCode if missing
            const needsUpdate: Record<string, unknown> = {};
            if (!(userRow.email as string) && userEmail) needsUpdate.email = userEmail;
            if (!(userRow.username as string) && userDisplayName) needsUpdate.username = userDisplayName;
            
            // Auto-verify all users — email verification is no longer required
            if (Number(userRow.emailVerified || userRow.email_verified || 0) === 0) {
              needsUpdate.emailVerified = 1;
              needsUpdate.verifiedAt = new Date().toISOString();
              needsUpdate.verificationMethod = 'automatic_signup';
            }
            
            if (!userRow.referralCode) {
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
              let newCode = '';
              for (let i = 0; i < 8; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));
              needsUpdate.referralCode = newCode;
            }

            // Link to referrer if missing and pending code exists
            if (!userRow.referredById || (userRow.referredById as string) === '') {
              const pendingCode = localStorage.getItem('pending_referral_code');
              if (pendingCode) {
                const referrers = await blink.db.users.list({ where: { referralCode: pendingCode }, limit: 1 });
                if (referrers && referrers.length > 0) {
                  const rid = referrers[0].id;
                  if (rid !== userId) {
                    needsUpdate.referredById = rid;
                    needsUpdate.referralCodeUsed = pendingCode; // permanent record
                    console.log('[Referral] Linking existing user to referrer:', rid, 'code:', pendingCode);
                  }
                }
                localStorage.removeItem('pending_referral_code');
              }
            }

            if (Object.keys(needsUpdate).length > 0) {
              await blink.db.users.update(userId, needsUpdate);
            }
          }).catch((backgroundError) => {
            console.warn('[useUserStats] Background profile initialization failed:', backgroundError);
          });

          return statsData;
        } else {
          // New user — create the minimum account row immediately. Referral
          // linking is secondary and must not block the account becoming ready.
          const defaultName = userDisplayName || 'Trainer_' + userId.slice(-4);
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let ownCode = '';
          for (let i = 0; i < 8; i++) ownCode += chars.charAt(Math.floor(Math.random() * chars.length));

          await blink.db.users.create({
            id: userId,
            balance: 0,
            displayName: defaultName,
            username: defaultName,
            email: userEmail || '',
            avatarUrl: '',
            emailVerified: 1,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'automatic_signup',
            role: '',
            isBanned: false,
            isDeleted: false,
            referralCode: ownCode,
            referralRewardPaid: false,
          }).catch(async (createErr: any) => {
            if (createErr?.status !== 409) throw createErr;
          });

          return {
            balance: 0,
            matchedBalance: 0,
            displayName: defaultName, avatarUrl: '',
            email: userEmail || '', username: defaultName,
            emailVerified: true, role: '', isBanned: false,
            isDeleted: false,
            referralCode: ownCode,
          };
        }
      } catch (error: any) {
        console.error('[useUserStats] Critical profile load failed:', error);
        throw error;
      }
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attempt => Math.min(750 * 2 ** attempt, 3000),
  });

  // Listen for realtime balance updates
  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | null = null;

    const setupRealtime = async () => {
      try {
        unsub = await blink.realtime.subscribe(`user-updates-${userId}`, (msg) => {
          if (msg.type === 'balance_updated') {
            const nextBalance = Number(msg.data?.newBalance) || 0;
            const nextMatchedBalance = Number(msg.data?.newMatchedBalance);
            console.log('[Realtime] Balance updated received:', msg.data);
            qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => 
              prev ? { ...prev, balance: nextBalance, ...(Number.isFinite(nextMatchedBalance) ? { matchedBalance: nextMatchedBalance } : {}) } : null
            );
            qc.setQueryData([...BALANCE_QUERY_KEY, userId], (prev: BalanceData | undefined) =>
              prev ? { ...prev, balance: nextBalance, ...(Number.isFinite(nextMatchedBalance) ? { matchedBalance: nextMatchedBalance } : {}) } : { balance: nextBalance, matchedBalance: Number.isFinite(nextMatchedBalance) ? nextMatchedBalance : 0 }
            );
            // Force all observers to pick up the new balance immediately
            qc.invalidateQueries({ queryKey: [...USER_STATS_QUERY_KEY, userId] });
            qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });
          }
        });
      } catch (err) {
        console.warn('[Realtime] Subscription failed:', err);
      }
    };

    setupRealtime();
    return () => { if (unsub) unsub(); };
  }, [userId, qc]);

  const updateBalance = async (newBalance: number) => {
    if (!userId) return;
    // Backend is the source of truth — update the local cache directly.
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => 
      prev ? { ...prev, balance: newBalance } : null
    );
    qc.setQueryData([...BALANCE_QUERY_KEY, userId], (prev: BalanceData | undefined) =>
      prev ? { ...prev, balance: newBalance } : { balance: newBalance, matchedBalance: 0 }
    );
    // Force all observers to confirm via DB refetch
    qc.invalidateQueries({ queryKey: [...USER_STATS_QUERY_KEY, userId] });
    qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });
  };

  const updateProfile = async (updates: { displayName?: string; avatarUrl?: string; email?: string; username?: string }) => {
    if (!userId) return;
    await blink.db.users.update(userId, updates);
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: UserStats | null) => 
      prev ? { ...prev, ...updates } : null
    );
  };

  const setStats = useCallback((newStats: UserStats | null) => {
    qc.setQueryData([...USER_STATS_QUERY_KEY, userId], newStats);
  }, [qc, userId]);

  return { stats, loading, updateBalance, updateProfile, setStats, refetch };
}