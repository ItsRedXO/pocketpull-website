/**
 * POST /admin/emails/send
 * Lets an admin compose and send a one-off email via Resend from the
 * Email Center tab. Reuses sendEmailWithLog so composed emails show up
 * in the same outboundEmails delivery log as every other transactional send.
 */
import { Hono } from 'hono';
import { resolveUserId, getBlinkDb } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { sendEmailWithLog } from '../lib/emailLogging';

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

function renderHtml(subject: string, bodyText: string) {
  const escaped = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const withBreaks = escaped.split('\n').map(line => line || '&nbsp;').join('<br/>');
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0e1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
      <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
      <div style="padding:32px 36px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9b5cff;font-weight:700;">${SENDER_NAME}</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#fff;font-weight:800;">${subject}</h1>
        <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;">${withBreaks}</p>
      </div>
      <div style="padding:14px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
        <p style="margin:0;font-size:12px;color:#4b5563;">© ${SENDER_NAME} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
      </div>
    </div>
  `;
}

app.post('/admin/emails/send', async c => {
  try {
    await requireAdmin(c);
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Failed to authorize' }, status);
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

  try {
    const result = await sendEmailWithLog(getBlinkDb(), {
      to: recipients.length === 1 ? recipients[0] : recipients,
      from: `${SENDER_NAME} <${SUPPORT_EMAIL}>`,
      replyTo: SUPPORT_EMAIL,
      subject,
      text: message,
      html: renderHtml(subject, message),
    }, { emailType: 'admin_compose' });
    return c.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return c.json({ error: error?.message || 'Failed to send email' }, 502);
  }
});

export default app;
