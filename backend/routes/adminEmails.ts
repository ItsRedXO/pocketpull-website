/**
 * Admin email routes:
 *   POST /admin/emails/send         – compose to specific recipients
 *   POST /admin/emails/broadcast    – send to all subscribed users
 *   GET  /admin/emails/subscribers  – list users with subscription status
 *   POST /admin/emails/subscribers/:userId/resubscribe – re-enable subscription
 *   GET  /unsubscribe               – public one-click unsubscribe (token in query)
 */
import { Hono } from 'hono';
import { resolveUserId, getBlinkDb } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { sendEmailWithLog } from '../lib/emailLogging';
import { verifyUnsubscribeToken, makeUnsubscribeUrl } from '../lib/unsubscribeToken';

const app = new Hono();

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';
const SENDER_NAME = 'PocketPull TCG';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin(c: any) {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]) return;
  }
  const userId = await resolveUserId(c);
  if (!userId) throw new Error('UNAUTHORIZED');
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
}

function renderHtml(subject: string, bodyText: string, unsubscribeUrl?: string) {
  const escaped = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const withBreaks = escaped.split('\n').map((line: string) => line || '&nbsp;').join('<br/>');
  const unsubFooter = unsubscribeUrl
    ? `<br/><a href="${unsubscribeUrl}" style="color:#6b7280;font-size:11px;text-decoration:underline;">Unsubscribe from marketing emails</a>`
    : '';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0e1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
      <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
      <div style="padding:32px 36px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9b5cff;font-weight:700;">${SENDER_NAME}</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#fff;font-weight:800;">${subject}</h1>
        <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;">${withBreaks}</p>
      </div>
      <div style="padding:14px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
        <p style="margin:0;font-size:12px;color:#4b5563;">© ${SENDER_NAME} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a>${unsubFooter}</p>
      </div>
    </div>
  `;
}

const UNSUB_PAGE = (message: string, color: string, icon: string, extra = '') => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message} – PocketPull TCG</title></head>
<body style="font-family:sans-serif;background:#0d0e1a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;">
  <div style="text-align:center;max-width:440px;">
    <div style="font-size:56px;margin-bottom:16px;">${icon}</div>
    <h1 style="color:${color};margin:0 0 12px;font-size:28px;">${message}</h1>
    ${extra}
    <p style="margin:16px 0 0;font-size:12px;color:#4b5563;">
      Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a>
    </p>
  </div>
</body>
</html>`;

// ── Public: one-click unsubscribe ─────────────────────────────────────────────
app.get('/unsubscribe', async c => {
  const token = c.req.query('token') || '';
  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    return c.html(UNSUB_PAGE(
      'Invalid Link',
      '#f87171',
      '❌',
      '<p style="color:#9ca3af;margin:0;">This unsubscribe link is invalid or has already been used. Contact us if you need help opting out.</p>',
    ), 400);
  }

  try {
    await query('UPDATE users SET email_subscribed = FALSE WHERE id = $1', [userId]);
    return c.html(UNSUB_PAGE(
      "You've been unsubscribed",
      '#10b981',
      '✅',
      '<p style="color:#9ca3af;margin:0;">You\'ve been removed from our marketing emails. Transactional emails (receipts, password resets) will still be sent as needed.</p>',
    ));
  } catch (error: any) {
    console.error('[unsubscribe] Failed to update user:', error?.message);
    return c.html(UNSUB_PAGE(
      'Something went wrong',
      '#f87171',
      '⚠️',
      '<p style="color:#9ca3af;margin:0;">Please try again or contact us directly to opt out.</p>',
    ), 500);
  }
});

// ── Admin: list users with subscription status ────────────────────────────────
app.get('/admin/emails/subscribers', async c => {
  try { await requireAdmin(c); } catch (error: any) {
    return c.json({ error: error?.message || 'Unauthorized' }, error?.message === 'UNAUTHORIZED' ? 401 : 403);
  }

  try {
    const rows = await query<{ id: string; email: string; username: string; email_subscribed: boolean; created_at: string }>(
      `SELECT id, email,
              COALESCE(display_name, username, 'Unknown') AS username,
              COALESCE(email_subscribed, TRUE) AS email_subscribed,
              created_at
       FROM users
       WHERE email IS NOT NULL AND email != ''
         AND (is_deleted IS NULL OR is_deleted = 0)
       ORDER BY created_at DESC
       LIMIT 5000`,
    );
    const subscribed = rows.filter(r => r.email_subscribed).length;
    return c.json({ subscribers: rows, total: rows.length, subscribed, unsubscribed: rows.length - subscribed });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to fetch subscribers' }, 500);
  }
});

// ── Admin: re-enable a user's subscription ────────────────────────────────────
app.post('/admin/emails/subscribers/:userId/resubscribe', async c => {
  try { await requireAdmin(c); } catch (error: any) {
    return c.json({ error: error?.message || 'Unauthorized' }, error?.message === 'UNAUTHORIZED' ? 401 : 403);
  }

  const userId = c.req.param('userId');
  try {
    await query('UPDATE users SET email_subscribed = TRUE WHERE id = $1', [userId]);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to resubscribe user' }, 500);
  }
});

// ── Admin: compose to specific recipients ─────────────────────────────────────
app.post('/admin/emails/send', async c => {
  try { await requireAdmin(c); } catch (error: any) {
    return c.json({ error: error?.message || 'Unauthorized' }, error?.message === 'UNAUTHORIZED' ? 401 : 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message : '';

  const recipients = to.split(',').map((s: string) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return c.json({ error: 'Recipient is required' }, 400);
  const invalid = recipients.find((r: string) => !EMAIL_RE.test(r));
  if (invalid) return c.json({ error: `"${invalid}" is not a valid email address` }, 400);
  if (!subject) return c.json({ error: 'Subject is required' }, 400);
  if (!message.trim()) return c.json({ error: 'Message body is required' }, 400);

  let unsubUrl: string | undefined;
  if (recipients.length === 1) {
    const userRows = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [recipients[0]]);
    if (userRows[0]) unsubUrl = makeUnsubscribeUrl(userRows[0].id);
  }

  try {
    const result = await sendEmailWithLog(getBlinkDb(), {
      to: recipients.length === 1 ? recipients[0] : recipients,
      from: `${SENDER_NAME} <${SUPPORT_EMAIL}>`,
      replyTo: SUPPORT_EMAIL,
      subject,
      text: message,
      html: renderHtml(subject, message, unsubUrl),
    }, { emailType: 'admin_compose' });
    return c.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to send email' }, 502);
  }
});

// ── Admin: broadcast to all subscribed users ──────────────────────────────────
app.post('/admin/emails/broadcast', async c => {
  try { await requireAdmin(c); } catch (error: any) {
    return c.json({ error: error?.message || 'Unauthorized' }, error?.message === 'UNAUTHORIZED' ? 401 : 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message : '';

  if (!subject) return c.json({ error: 'Subject is required' }, 400);
  if (!message.trim()) return c.json({ error: 'Message body is required' }, 400);

  const users = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users
     WHERE email IS NOT NULL AND email != ''
       AND COALESCE(email_subscribed, TRUE) = TRUE
       AND (is_deleted IS NULL OR is_deleted = 0)
     LIMIT 10000`,
  );

  if (users.length === 0) return c.json({ error: 'No subscribed users found' }, 400);

  const blink = getBlinkDb();
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendEmailWithLog(blink, {
        to: user.email,
        from: `${SENDER_NAME} <${SUPPORT_EMAIL}>`,
        replyTo: SUPPORT_EMAIL,
        subject,
        text: message,
        html: renderHtml(subject, message, makeUnsubscribeUrl(user.id)),
      }, { emailType: 'admin_broadcast' });
      sent++;
    } catch {
      failed++;
    }
  }

  return c.json({ success: true, sent, failed, total: users.length });
});

export default app;
