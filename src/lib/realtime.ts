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

/** Drop-in replacement for blink.realtime.channel(name) -- presence only. */
export function channel(name: string) {
  if (!supabase) {
    return {
      async subscribe() {},
      onPresence(_fn: (users: any[]) => void) {},
      async getPresence(): Promise<any[]> { return []; },
      async unsubscribe() {},
    };
  }

  const ch = supabase.channel(name, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
  let latest: any[] = [];
  let presenceCallback: ((users: any[]) => void) | null = null;

  // Must be registered before subscribe() per Supabase's contract.
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    latest = Object.values(state).flat();
    presenceCallback?.(latest);
  });

  return {
    async subscribe() {
      await new Promise<void>((resolve) => {
        ch.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            try { await ch.track({ online_at: new Date().toISOString() }); } catch { /* best-effort */ }
            resolve();
          }
        });
      });
    },
    onPresence(fn: (users: any[]) => void) {
      presenceCallback = fn;
    },
    async getPresence(): Promise<any[]> {
      return latest;
    },
    async unsubscribe() {
      try { await ch.untrack(); } catch { /* best-effort */ }
      supabase?.removeChannel(ch);
    },
  };
}

export const realtime = { publish, subscribe, channel };
