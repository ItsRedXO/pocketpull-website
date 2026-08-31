/**
 * src/hooks/useSoundSetting.ts
 *
 * Single source of truth for the user's "Sound Effects" preference.
 * Persists to localStorage so it survives reloads and is shared across
 * tabs in the same browser.
 *
 * Default is ON (true) so new users immediately hear ticking on
 * their first pack opening.
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'pocketpull_sound_enabled';

function readInitial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;            // default ON
    return v === 'true' || v === '1';
  } catch {
    return true;
  }
}

export function useSoundSetting(): {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(readInitial);

  // Persist on change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch { /* ignore quota / private-mode errors */ }
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
  }, []);

  const toggle = useCallback(() => {
    setEnabledState(prev => !prev);
  }, []);

  return { enabled, setEnabled, toggle };
}