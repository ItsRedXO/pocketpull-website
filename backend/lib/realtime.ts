import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = url && key ? createClient(url, key) : null;

const channels = new Map<string, RealtimeChannel>();

async function getReadyChannel(name: string): Promise<RealtimeChannel | null> {
  if (!client) return null;
  const existing = channels.get(name);
  if (existing) return existing;

  const ch = client.channel(name);
  channels.set(name, ch);
  await new Promise<void>((resolve) => {
    ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') resolve(); });
  });
  return ch;
}

/** Server-side drop-in replacement for blink.realtime.publish(channel, type, data). */
export async function publish(channelName: string, type: string, data: any = {}): Promise<void> {
  const ch = await getReadyChannel(channelName);
  if (!ch) return;
  await ch.send({ type: 'broadcast', event: type, payload: data });
}

export const realtime = { publish };
