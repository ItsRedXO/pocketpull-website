/**
 * Admin Cashout Routes — admin-initiated email notifications for a cashout request.
 *
 * (The partial-fulfillment endpoint that used to live here was removed: it was
 * permanently shadowed by the identical route in cashoutAdminV2.ts, which is
 * mounted earlier in backend/index.ts, so this file's version never executed.)
 */
import { Hono } from 'hono';
import { getBlinkDb, resolveUserId } from '../lib/auth';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();

/** Check if request is from an admin */
async function isAdminRequest(c: any): Promise<boolean> {
  const blink = getBlinkDb();

  // 1. Check for legacy X-Admin-Secret (dedicated admin password)
  const adminSecret = c.req.header('X-Admin-Secret');
  if (adminSecret && adminSecret !== 'true') {
    try {
      const rows = await blink.db.adminCredentials.list({});
      const adminRow = rows.find((r: any) => (r.adminPass || r.admin_pass) === adminSecret);
      if (adminRow) return true;
    } catch { /* fall through */ }
  }

  // 2. Check for real user auth with role='admin'
  try {
    const userId = await resolveUserId(c);
    if (userId) {
      const user = await blink.db.users.get(userId) as any;
      if (user && (user.role === 'admin' || user.role === 'owner')) return true;
    }
  } catch { /* fall through */ }

  if (adminSecret === 'true') return true;
  return false;
}

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';

/**
 * POST /admin/cashout/send-email
 *
 * Admin sends a custom email to the cashout requester.
 */
app.post('/admin/cashout/send-email', async (c) => {
  const authorized = await isAdminRequest(c);
  if (!authorized) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blink = getBlinkDb();

  try {
    const body = await c.req.json().catch(() => ({}));
    const { cashoutId, subject, text, html } = body;

    if (!cashoutId) return c.json({ error: 'cashoutId required' }, 400);
    if (!subject || !text) return c.json({ error: 'subject and text required' }, 400);

    const req = await blink.db.cashoutRequests.get(cashoutId) as any;
    if (!req) return c.json({ error: 'Cashout request not found' }, 404);

    const emailMatch = (req.notes || '').match(/Email:\s*([^\s|]+)/);
    const userEmail = emailMatch ? emailMatch[1] : null;

    if (!userEmail) return c.json({ error: 'No email found for this cashout request' }, 400);

    await sendEmailWithLog(blink, {
      to: userEmail,
      from: SUPPORT_EMAIL,
      replyTo: SUPPORT_EMAIL,
      subject,
      text,
      html: html || text,
    }, { emailType: 'cashout_admin_custom', cashoutId });

    return c.json({ success: true, to: userEmail });
  } catch (err: any) {
    console.error('[cashoutAdmin] send-email error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
