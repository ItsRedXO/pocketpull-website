import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { supabase } from '../lib/supabase';
import { BACKEND_BASE } from '../lib/backend';
import { BALANCE_QUERY_KEY, type BalanceData } from './useBalance';

type AuthUser = { id: string; email?: string; displayName?: string; emailVerified?: boolean; [key: string]: unknown };

/**
 * Blink's signInWithEmail only accepts an actual email address. The login
 * form is labeled "email or username", so resolve a bare username to its
 * account email via the public lookup endpoint before authenticating.
 */
async function resolveLoginEmail(identifier: string): Promise<string> {
  if (identifier.includes('@')) return identifier;
  const params = new URLSearchParams({ username: identifier });
  const response = await fetch(`${BACKEND_BASE}/auth/user-lookup?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  const match = Array.isArray(payload?.users) ? payload.users[0] : null;
  if (!match?.email) throw new Error('INVALID_CREDENTIALS');
  return match.email;
}

/**
 * Phase 3 of the Blink -> Supabase Auth migration: silently creates and
 * links a Supabase Auth identity for this account, using the password the
 * user just typed (see backend/routes/authSupabase.ts POST
 * /auth/silent-migrate). Idempotent -- a no-op once already linked.
 */
async function silentlyMigrateToSupabase(password: string): Promise<void> {
  const token = await blink.auth.getValidToken();
  if (!token) return;
  await fetch(`${BACKEND_BASE}/auth/silent-migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
}

/**
 * Phase 4: after a successful Blink sign-in, ensure the account is linked
 * (Phase 3) and then opportunistically sign into Supabase directly with
 * the same credentials to establish a real session. This only succeeds for
 * accounts already linked from a *previous* login (the very first
 * migration only creates the Supabase identity -- signing into it here on
 * the same pass is a bonus that also works, since the identity now exists
 * with this exact password).
 *
 * Never awaited by the caller and never throws -- must not affect or delay
 * the actual login in any way. Accounts with no Supabase session simply
 * keep using Blink; see getPreferredAuthToken() in ../lib/blink.ts.
 */
async function establishSupabaseSession(email: string, password: string): Promise<void> {
  try {
    await silentlyMigrateToSupabase(password);
  } catch {
    // Best-effort -- Blink remains the account's working login regardless.
  }
  if (!supabase) return;
  try {
    await supabase.auth.signInWithPassword({ email, password });
  } catch {
    // Not linked yet, or Supabase unreachable -- fine, try again next login.
  }
}

/**
 * Resolves a live Supabase session (if any) to this app's AuthUser shape by
 * asking the backend (GET /auth/whoami-supabase, which verifies the token
 * and looks up the linked usr_XXXX row) rather than trusting anything
 * client-side. Phase 5: this is now the primary identity source -- Blink's
 * onAuthStateChanged (below, in useAuth) is only consulted once this hook
 * has finished its own check and found nothing.
 *
 * Also completes brand-new Supabase-native signups: if a verified session
 * exists but no account is linked yet (a fresh signUp(), or the delayed
 * moment right after an email-confirmation click), it calls
 * POST /auth/complete-supabase-signup once to create the row -- the
 * username/referralCode signUp() embedded in the Supabase user's own
 * metadata -- then re-resolves. Idempotent, so a re-render or reload never
 * creates a duplicate account.
 */
function useSupabaseAuthUser(): { user: AuthUser | null; resolved: boolean } {
  const [state, setState] = useState<{ user: AuthUser | null; resolved: boolean }>({ user: null, resolved: !supabase });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function resolveFromToken(token: string, allowSignupCompletion: boolean) {
      try {
        const res = await fetch(`${BACKEND_BASE}/auth/whoami-supabase`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const payload = await res.json();
          const a = payload?.account;
          if (a && !cancelled) {
            setState({ user: { id: a.id, email: a.email, displayName: a.display_name || a.username, emailVerified: true }, resolved: true });
            return;
          }
        }
        if (res.status === 404 && allowSignupCompletion) {
          const completeRes = await fetch(`${BACKEND_BASE}/auth/complete-supabase-signup`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (completeRes.ok) { await resolveFromToken(token, false); return; }
        }
        if (!cancelled) setState({ user: null, resolved: true });
      } catch {
        if (!cancelled) setState({ user: null, resolved: true });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return; // handled by the /reset-password page, not a real sign-in
      const token = session?.access_token;
      if (!token) { if (!cancelled) setState({ user: null, resolved: true }); return; }
      void resolveFromToken(token, true);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}

export function useAuth() {
  const { user: supabaseUser, resolved: supabaseResolved } = useSupabaseAuthUser();
  const [blinkState, setBlinkState] = useState<{ user: AuthUser | null; isLoading: boolean }>({ user: null, isLoading: true });

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state: { user: AuthUser | null; isLoading: boolean }) => {
      setBlinkState(state);
    });
    const fallback = window.setTimeout(() => setBlinkState(s => ({ ...s, isLoading: false })), 5000);
    return () => { window.clearTimeout(fallback); unsubscribe(); };
  }, []);

  // Supabase is checked first: once it resolves (fast, local-session read),
  // a found user wins outright and Blink is never even waited on. Only
  // when Supabase has nothing do we fall through to Blink's own state --
  // covering accounts that haven't migrated yet.
  const user = supabaseUser || (supabaseResolved ? blinkState.user : null);
  const isLoading = !supabaseResolved || (!supabaseUser && blinkState.isLoading);

  const signIn = async (emailOrUsername: string, password: string) => {
    const identifier = emailOrUsername.trim();
    if (!identifier || !password) throw new Error('INVALID_CREDENTIALS');
    const email = await resolveLoginEmail(identifier);

    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return; // onAuthStateChange picks this up
    }

    // Falls through for: accounts not yet migrated, or whose Blink password
    // changed more recently than their Supabase identity was last synced
    // (password resets remain Blink-only for now -- see sendPasswordReset).
    const result = await blink.auth.signInWithEmail(email, password);
    void establishSupabaseSession(email, password);
    return result;
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();
    const trimmedReferral = referralCode?.trim().toUpperCase() || '';
    if (trimmedReferral) localStorage.setItem('pending_referral_code', trimmedReferral);

    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { username: trimmedUsername, referralCode: trimmedReferral } },
      });
      if (!error) {
        if (!data.session) {
          // Email confirmation is required before a session exists. The
          // account row itself gets created the moment a session first
          // appears -- see useSupabaseAuthUser above -- whether that's now
          // or after they click the confirmation link.
          throw new Error('CONFIRM_EMAIL_SENT');
        }
        const res = await fetch(`${BACKEND_BASE}/auth/complete-supabase-signup`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Sign up failed');
        return payload;
      }
      if (error.message?.toLowerCase().includes('already registered')) throw new Error('EMAIL_ALREADY_EXISTS');
      // Any other Supabase failure (e.g. its transactional email service
      // being down, confirmed to happen in practice -- "Error sending
      // confirmation email") falls through to Blink below instead of
      // blocking signup outright. Same resilience principle as signIn.
    }

    return blink.auth.signUp({ email: trimmedEmail, password, displayName: trimmedUsername });
  };

  // A stale Supabase session must never outlive a Blink sign-out -- getPreferredAuthToken()
  // (../lib/blink.ts) would otherwise keep authenticating as this user after "logout".
  const signOutAll = async () => {
    if (supabase) await supabase.auth.signOut().catch(() => {});
    return blink.auth.signOut();
  };

  const sendPasswordReset = async (email: string) => {
    // Supabase's reset is sent opportunistically alongside Blink's -- Blink's
    // is the one guaranteed to work today for every account regardless of
    // migration status, so it alone decides success/failure here. Once
    // real-world Supabase email deliverability is confirmed this can become
    // the only path for already-linked accounts.
    const results = await Promise.allSettled([
      supabase ? supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }) : Promise.resolve(),
      blink.auth.sendPasswordResetEmail(email),
    ]);
    const blinkResult = results[1];
    if (blinkResult.status === 'rejected') {
      const supabaseResult = results[0];
      if (supabaseResult.status === 'rejected') throw blinkResult.reason;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut: signOutAll,
    login: () => blink.auth.login(),
    logout: signOutAll,
    sendPasswordReset,
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

const USER_STATS_QUERY_KEY = ['user-stats'];

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
      // is_banned/is_deleted/referral_reward_paid are integer columns (0/1), matching
      // email_verified above -- not native booleans. Sending JS `false` fails with
      // "invalid input syntax for type integer" and silently orphans the signup.
      await blink.db.users.create({ id: userId, balance: 0, matchedBalance: 0, displayName, username: displayName, email: userEmail || '', avatarUrl: '', emailVerified: 1, role: '', isBanned: 0, isDeleted: 0, referralCode, referralRewardPaid: 0 }).catch((error: any) => { if (error?.status !== 409) throw error; });
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