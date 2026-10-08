import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setGuestToken, getGuestToken } from '../lib/blink';
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

  // On mount: if isGuest=true, verify the guest token still exists in
  // sessionStorage. If not (tab closed and reopened, or token cleared),
  // reset so the user isn't stuck in a broken state.
  useEffect(() => {
    if (!state.isGuest) return;
    if (!getGuestToken()) {
      setState({ isGuest: false, actionsUsed: 0, hasOpenedPack: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markPackOpened = useCallback(() => {
    setStateRaw(prev => {
      const next = { ...prev, hasOpenedPack: true };
      save(next);
      return next;
    });
  }, []);

  const startGuestTrial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/auth/guest-session`, { method: 'POST' });
      if (!res.ok) throw new Error(`Guest session failed: ${res.status}`);
      const data = await res.json() as { token: string; userId: string };
      setGuestToken(data.token);
      setState({ isGuest: true, actionsUsed: 0, hasOpenedPack: false });
    } catch (err) {
      console.error('[GuestTrial] Failed to start:', err);
    } finally {
      setLoading(false);
    }
  }, [setState]);

  const endGuestTrial = useCallback(() => {
    setGuestToken(null);
    setState({ isGuest: false, actionsUsed: 0, hasOpenedPack: false });
    setSignupWallVisible(false);
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
