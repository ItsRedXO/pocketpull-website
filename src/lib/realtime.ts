import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface RealtimeEvent<T = any> {
  type: string;
  event: string;
  data: T;
}

type Listener = (event: RealtimeEvent) => void;
type Unsubscribe = () => void;

interface Entry {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  ready: Promise<void>;
}

const entries = new Map<string, Entry>();

function ensureEntry(name: string): Entry | null {
  if (!supabase) return null;
  const existing = entries.get(name);
  if (existing) return existing;

  const ch = supabase.channel(name);
  const listeners = new Set<Listener>();
  ch.on('broadcast', { event: '*' }, (msg: any) => {
    const evt: RealtimeEvent = { type: msg.event, event: msg.event, data: msg.payload };
    listeners.forEach(fn => { try { fn(evt); } catch { /* listener error, ignore */ } });
  });
  const ready = new Promise<void>((resolve) => {
    ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') resolve(); });
  });

  const entry: Entry = { channel: ch, listeners, ready };
  entries.set(name, entry);
  return entry;
}

/** Drop-in replacement for blink.realtime.publish(channel, type, data). */
export async function publish(channelName: string, type: string, data: any = {}): Promise<void> {
  const entry = ensureEntry(channelName);
  if (!entry) return;
  await entry.ready;
  await entry.channel.send({ type: 'broadcast', event: type, payload: data });
}

/** Drop-in replacement for blink.realtime.subscribe(channel, callback) -> unsubscribe. */
export async function subscribe(channelName: string, callback: Listener): Promise<Unsubscribe> {
  const entry = ensureEntry(channelName);
  if (!entry) return () => {};
  entry.listeners.add(callback);
  await entry.ready;
  return () => {
    entry.listeners.delete(callback);
    if (entry.listeners.size === 0 && supabase) {
      supabase.removeChannel(entry.channel);
      entries.delete(channelName);
    }
  };
}

interface PresenceEntry {
  channel: RealtimeChannel;
  callbacks: Set<(users: any[]) => void>;
  latest: any[];
  ready: Promise<void> | null;
  refCount: number;
}

const presenceEntries = new Map<string, PresenceEntry>();

/**
 * Drop-in replacement for blink.realtime.channel(name) -- presence only.
 * Multiple callers passing the same name (e.g. useLiveCounters is mounted
 * from several components at once) share one real underlying channel --
 * Supabase throws if you try to register a second presence handler on a
 * topic that's already mid-subscribe, so this must not create a new
 * supabase.channel() per caller.
 */
export function channel(name: string) {
  if (!supabase) {
    return {
      async subscribe() {},
      onPresence(_fn: (users: any[]) => void) {},
      async getPresence(): Promise<any[]> { return []; },
      async unsubscribe() {},
    };
  }
  const activeSupabase = supabase;

  let entry = presenceEntries.get(name);
  if (!entry) {
    const ch = activeSupabase.channel(name, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
    const newEntry: PresenceEntry = { channel: ch, callbacks: new Set(), latest: [], ready: null, refCount: 0 };
    // Must be registered before subscribe() per Supabase's contract.
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      newEntry.latest = Object.values(state).flat();
      newEntry.callbacks.forEach(fn => { try { fn(newEntry.latest); } catch { /* listener error, ignore */ } });
    });
    presenceEntries.set(name, newEntry);
    entry = newEntry;
  }
  entry.refCount++;
  const activeEntry = entry;
  let myCallback: ((users: any[]) => void) | null = null;

  return {
    async subscribe() {
      if (!activeEntry.ready) {
        activeEntry.ready = new Promise<void>((resolve) => {
          activeEntry.channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              try { await activeEntry.channel.track({ online_at: new Date().toISOString() }); } catch { /* best-effort */ }
              resolve();
            }
          });
        });
      }
      await activeEntry.ready;
    },
    onPresence(fn: (users: any[]) => void) {
      if (myCallback) activeEntry.callbacks.delete(myCallback);
      myCallback = fn;
      activeEntry.callbacks.add(fn);
    },
    async getPresence(): Promise<any[]> {
      return activeEntry.latest;
    },
    async unsubscribe() {
      if (myCallback) { activeEntry.callbacks.delete(myCallback); myCallback = null; }
      activeEntry.refCount--;
      if (activeEntry.refCount <= 0) {
        try { await activeEntry.channel.untrack(); } catch { /* best-effort */ }
        activeSupabase.removeChannel(activeEntry.channel);
        presenceEntries.delete(name);
      }
    },
  };
}

export const realtime = { publish, subscribe, channel };
