import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BACKEND_BASE } from '../lib/backend';

const STORAGE_KEY = 'pocketpull_guest_trial';
const MAX_ACTIONS = 10;

interface StoredState {
  isGuest: boolean;
  actionsUsed: number;
  hasOpenedPack: boolean;
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isGuest: false, actionsUsed: 0, hasOpenedPack: false };
    const parsed = JSON.parse(raw) as StoredState;
    return { hasOpenedPack: false, ...parsed };
  } catch {
    return { isGuest: false, actionsUsed: 0, hasOpenedPack: false };
  }
}

function save(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

interface GuestTrialContextValue {
  isGuest: boolean;
  guestTrialLoading: boolean;
  actionsUsed: number;
  actionsLeft: number;
  canAct: boolean;
  hasOpenedPack: boolean;
  markPackOpened: () => void;
  consumeAction: () => void;
  startGuestTrial: () => Promise<void>;
  endGuestTrial: () => void;
  showSignupWall: boolean;
  dismissSignupWall: () => void;
}

const GuestTrialContext = createContext<GuestTrialContextValue | null>(null);

export function GuestTrialProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<StoredState>(load);
  const [signupWallVisible, setSignupWallVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const setState = useCallback((s: StoredState) => {
    save(s);
    setStateRaw(s);
  }, []);

  // On mount: verify the anonymous Supabase session is still alive.
  // If it's gone (expired or cleared), reset guest state so the user
  // isn't stuck in a broken mode where isGuest=true but no token exists.
  useEffect(() => {
    if (!state.isGuest) return;
    if (!supabase) { setState({ isGuest: false, actionsUsed: 0, hasOpenedPack: false }); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setState({ isGuest: false, actionsUsed: 0, hasOpenedPack: false });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markPackOpened = useCallback(() => {
    setStateRaw(prev => {
      const next = { ...prev, hasOpenedPack: true };
      save(next);
      return next;
    });
  }, []);

  const startGuestTrial = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) throw error || new Error('No anonymous session');

      await fetch(`${BACKEND_BASE}/auth/guest-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      setState({ isGuest: true, actionsUsed: 0, hasOpenedPack: false });
    } catch (err) {
      console.error('[GuestTrial] Failed to start:', err);
      // Still set isGuest=true optimistically — brawl will show API errors
      // on actual actions, which is a reasonable fallback.
      setState({ isGuest: true, actionsUsed: 0, hasOpenedPack: false });
    } finally {
      setLoading(false);
    }
  }, [setState]);

  const endGuestTrial = useCallback(() => {
    setState({ isGuest: false, actionsUsed: 0, hasOpenedPack: false });
    setSignupWallVisible(false);
    // Sign out the anonymous Supabase session so real auth can take over
    if (supabase) supabase.auth.signOut().catch(() => {});
  }, [setState]);

  const consumeAction = useCallback(() => {
    setStateRaw(prev => {
      const next = { ...prev, actionsUsed: prev.actionsUsed + 1 };
      save(next);
      if (next.actionsUsed >= MAX_ACTIONS) setSignupWallVisible(true);
      return next;
    });
  }, []);

  const dismissSignupWall = useCallback(() => setSignupWallVisible(false), []);

  const actionsLeft = Math.max(0, MAX_ACTIONS - state.actionsUsed);
  const canAct = state.isGuest && actionsLeft > 0;

  return (
    <GuestTrialContext.Provider value={{
      isGuest: state.isGuest,
      guestTrialLoading: loading,
      actionsUsed: state.actionsUsed,
      actionsLeft,
      canAct,
      hasOpenedPack: state.hasOpenedPack,
      markPackOpened,
      consumeAction,
      startGuestTrial,
      endGuestTrial,
      showSignupWall: signupWallVisible,
      dismissSignupWall,
    }}>
      {children}
    </GuestTrialContext.Provider>
  );
}

export function useGuestTrial(): GuestTrialContextValue {
  const ctx = useContext(GuestTrialContext);
  if (!ctx) throw new Error('useGuestTrial must be used within GuestTrialProvider');
  return ctx;
}
