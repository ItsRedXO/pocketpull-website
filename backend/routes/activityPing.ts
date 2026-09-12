import { Hono } from 'hono';
import { resolveUserId } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();

// Presence heartbeat for the admin panel's online/afk/offline dots -- see
// src/hooks/useActivityHeartbeat.ts for the client side. Cheap, throttled
// (one call per ~30s per open tab) fire-and-forget write; failures here
// should never surface to the user, so this deliberately has no retry logic
// on the client and just no-ops on error here.
app.post('/activity/ping', async c => {
  const userId = await resolveUserId(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const interacted = !!body.interacted;

  try {
    if (interacted) {
      await query('UPDATE users SET last_seen_at=now(), last_active_at=now() WHERE id=$1', [userId]);
    } else {
      await query('UPDATE users SET last_seen_at=now() WHERE id=$1', [userId]);
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to record activity' }, 500);
  }
});

export default app;
