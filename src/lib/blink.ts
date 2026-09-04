import { createClient } from '@blinkdotnew/sdk';
import { createPostgresDb } from './postgresDb';
import { BACKEND_BASE } from './backend';

const LEGACY_BACKEND = 'https://b2nnhe2n.backend.blink.new';

// Keep legacy API callers working during the Railway migration. Economy requests
// must reach the PostgreSQL backend, not the retired Blink backend.
if (typeof window !== 'undefined') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let target = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (target.startsWith(LEGACY_BACKEND)) {
      target = `${BACKEND_BASE}${target.slice(LEGACY_BACKEND.length)}`;
      if (typeof input === 'string' || input instanceof URL) return nativeFetch(target, init);
      return nativeFetch(new Request(target, input), init);
    }
    return nativeFetch(input, init);
  }) as typeof window.fetch;
}

const blinkClient = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'pocketpull-premium-site-b2nnhe2n',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_vT3Qhs4YE86jEwxvFWSg-5EcABJ06ofD',
  auth: { mode: 'headless' }
});

// Authentication and realtime remain on Blink; browser database traffic is routed
// through the PostgreSQL-backed Hono API. Login/signup need a small unauthenticated
// lookup before Blink can issue a session, so route those specific user lookups to
// the dedicated public endpoint instead of the authenticated DB proxy.
export const blink: any = new Proxy(blinkClient, {
  get(target, property, receiver) {
    if (property !== 'db') return Reflect.get(target, property, receiver);

    const tokenProvider = () => target.auth.getValidToken();
    const postgresDb = createPostgresDb(tokenProvider);
    const usersClient = postgresDb.users;

    return new Proxy(postgresDb, {
      get(dbTarget, dbProperty, dbReceiver) {
        if (dbProperty !== 'users') return Reflect.get(dbTarget, dbProperty, dbReceiver);

        return {
          ...usersClient,
          list: async (options: any = {}) => {
            let token: string | null = null;
            try { token = await tokenProvider(); } catch {}
            if (token) return usersClient.list(options);

            const where = options.where || {};
            const lookupKey = where.username ? 'username' : where.email ? 'email' : where.displayName ? 'displayName' : null;
            if (!lookupKey) return usersClient.list(options);

            const value = String(where[lookupKey]);
            const params = new URLSearchParams({ [lookupKey]: value });
            const response = await fetch(`${BACKEND_BASE}/auth/user-lookup?${params.toString()}`);
            const payload = await response.json() as any;
            if (!response.ok) {
              const error: any = new Error(payload?.error || `User lookup failed (${response.status})`);
              error.status = response.status;
              throw error;
            }
            return Array.isArray(payload?.users) ? payload.users : [];
          },
        };
      },
    });
  },
});

export const INVENTORY_CHANNEL = 'inventory-updates';
export const INVENTORY_UPDATED_EVENT = 'updated';

export const BATTLE_CHANNEL_PREFIX = 'battle-state';
export const BATTLE_LOBBY_CHANNEL = 'battle-lobby';
export const BATTLE_EVENTS = {
  PHASE_CHANGE: 'phase_change',
  ROUND_UPDATE: 'round_update',
  SPIN_TOGGLE: 'spin_toggle',
  BATTLE_FINISHED: 'battle_finished',
  RESULTS_READY: 'results_ready',
  COUNTDOWN_UPDATE: 'countdown_update',
  BATTLE_CANCELED: 'battle_canceled'
};
