import { useEffect, useRef } from 'react';
import { getPreferredAuthToken } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

const HEARTBEAT_INTERVAL_MS = 30_000;
const INTERACTION_EVENTS = ['click', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Presence signal for the admin panel's online/afk/offline dots. While a
 * logged-in user has a visible tab open, pings the backend roughly every
 * 30s reporting whether a real interaction (click/keydown/scroll/touch --
 * not just background query polling, which would otherwise make every open
 * tab look "active" forever) happened since the last ping. See
 * backend/routes/activityPing.ts.
 */
export function useActivityHeartbeat(enabled: boolean) {
  const interactedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const markInteracted = () => { interactedRef.current = true; };
    INTERACTION_EVENTS.forEach(evt => window.addEventListener(evt, markInteracted, { passive: true }));

    const ping = async () => {
      if (document.visibilityState !== 'visible') return;
      const interacted = interactedRef.current;
      interactedRef.current = false;
      try {
        const token = await getPreferredAuthToken();
        if (!token) return;
        await fetch(`${BACKEND_BASE}/activity/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ interacted }),
        });
      } catch { /* best-effort presence signal, never surfaced to the user */ }
    };

    void ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void ping(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      INTERACTION_EVENTS.forEach(evt => window.removeEventListener(evt, markInteracted));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [enabled]);
}
