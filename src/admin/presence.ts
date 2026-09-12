export type PresenceStatus = 'online' | 'afk' | 'offline';

const SEEN_TIMEOUT_MS = 90_000; // no heartbeat in 90s (3 missed 30s pings) -> tab closed
const AFK_THRESHOLD_MS = 5 * 60_000; // no real interaction in 5 min -> afk

/**
 * green (online): tab open and interacted with recently.
 * yellow (afk): tab still open (heartbeat fresh) but no click/keydown/
 *   scroll/touch in the last 5+ minutes.
 * red (offline): no heartbeat recently -- tab is closed or was never open.
 */
export function getPresenceStatus(lastSeenAt: string | null, lastActiveAt: string | null): PresenceStatus {
  if (!lastSeenAt) return 'offline';
  const seenAgo = Date.now() - new Date(lastSeenAt).getTime();
  if (seenAgo > SEEN_TIMEOUT_MS) return 'offline';
  const activeAgo = lastActiveAt ? Date.now() - new Date(lastActiveAt).getTime() : Infinity;
  return activeAgo > AFK_THRESHOLD_MS ? 'afk' : 'online';
}

export const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: '#10b981',
  afk: '#f59e0b',
  offline: '#ef4444',
};

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  afk: 'Away (idle 5+ min)',
  offline: 'Offline',
};
