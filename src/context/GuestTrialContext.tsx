import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MOCK_STARTER_ROSTER, getMockBrawlProfileResponse, getMockBrawlConfig,
} from '../lib/mockData';

const STORAGE_KEY = 'pocketpull_guest_trial';
const MAX_ACTIONS = 7;

interface StoredState {
  isGuest: boolean;
  actionsUsed: number;
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isGuest: false, actionsUsed: 0 };
    return JSON.parse(raw) as StoredState;
  } catch {
    return { isGuest: false, actionsUsed: 0 };
  }
}

function save(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

interface GuestTrialContextValue {
  isGuest: boolean;
  actionsUsed: number;
  actionsLeft: number;
  canAct: boolean;
  consumeAction: () => void;
  startGuestTrial: () => void;
  endGuestTrial: () => void;
  showSignupWall: boolean;
  dismissSignupWall: () => void;
}

const GuestTrialContext = createContext<GuestTrialContextValue | null>(null);

export function GuestTrialProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [state, setStateRaw] = useState<StoredState>(load);
  const [signupWallVisible, setSignupWallVisible] = useState(false);
  const seededRef = useRef(false);

  const setState = useCallback((s: StoredState) => {
    save(s);
    setStateRaw(s);
  }, []);

  const seedQueryCache = useCallback(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const profile = getMockBrawlProfileResponse();
    qc.setQueryData(['brawl-profile'], profile);
    qc.setQueryData(['brawl-roster'], { roster: MOCK_STARTER_ROSTER });
    qc.setQueryData(['brawl-config'], getMockBrawlConfig());
  }, [qc]);

  // Re-seed cache on mount if already in guest mode (page refresh)
  useEffect(() => {
    if (state.isGuest) seedQueryCache();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startGuestTrial = useCallback(() => {
    const next: StoredState = { isGuest: true, actionsUsed: 0 };
    setState(next);
    seedQueryCache();
  }, [setState, seedQueryCache]);

  const endGuestTrial = useCallback(() => {
    seededRef.current = false;
    setState({ isGuest: false, actionsUsed: 0 });
    setSignupWallVisible(false);
    qc.removeQueries({ queryKey: ['brawl-profile'] });
    qc.removeQueries({ queryKey: ['brawl-roster'] });
    qc.removeQueries({ queryKey: ['brawl-config'] });
  }, [setState, qc]);

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
      actionsUsed: state.actionsUsed,
      actionsLeft,
      canAct,
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
