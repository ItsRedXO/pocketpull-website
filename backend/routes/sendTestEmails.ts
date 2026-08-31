/**
 * POST /send-test-emails
 * Admin-only endpoint to send test emails for magic link, password reset,
 * and account verification — all from support@pocketpulltcg.com.
 * 
 * Body: { toEmail: string, adminSecret: string }
 */
import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';
const SENDER_NAME = 'PocketPullTCG';

app.post('/send-test-emails', async (c) => {
  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { toEmail, adminSecret } = body;

    if (!toEmail) return c.json({ error: 'toEmail required' }, 400);

    // Simple admin gate — check against stored admin credentials
    const adminRows = await blink.db.adminCredentials.list({ limit: 1 }) as any[];
    const admin = adminRows[0];
    if (!admin || adminSecret !== admin.adminPass) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const results: Record<string, string> = {};

    // ── 1. Magic Link test ──────────────────────────────────────────────────
    try {
      await sendEmailWithLog(blink, {
        to: toEmail,
        from: SUPPORT_EMAIL,
        replyTo: SUPPORT_EMAIL,
        subject: `[TEST] PocketPull TCG — Your Magic Sign-In Link`,
        text: [
          `PocketPull TCG — Magic Link Sign-In`,
          `====================================`,
          ``,
          `Hi there,`,
          ``,
          `This is a TEST magic link email from ${SENDER_NAME}.`,
          ``,
          `In production, this would contain a secure one-click sign-in link.`,
          `If you did not request this, please ignore.`,
          ``,
          `— ${SENDER_NAME}`,
          SUPPORT_EMAIL,
        ].join('\n'),
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0e1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
            <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
            <div style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9b5cff;font-weight:700;">${SENDER_NAME}</p>
              <h1 style="margin:0 0 16px;font-size:22px;color:#fff;font-weight:800;">Magic Sign-In Link [TEST]</h1>
              <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
                This is a <strong style="color:#fff;">TEST email</strong> sent from <strong>${SUPPORT_EMAIL}</strong>.<br>
                In production, this email delivers a secure one-click sign-in link.
              </p>
              <div style="background:rgba(155,92,255,0.08);border:1px solid rgba(155,92,255,0.3);border-radius:12px;padding:18px 22px;margin-bottom:24px;">
                <p style="margin:0;color:#9b5cff;font-size:13px;font-weight:700;">✓ Sender verified: ${SUPPORT_EMAIL}</p>
              </div>
              <p style="color:#6b7280;font-size:12px;margin:0;">If you did not request this, please ignore this email.</p>
            </div>
            <div style="padding:14px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
              <p style="margin:0;font-size:12px;color:#4b5563;">© ${SENDER_NAME} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
            </div>
          </div>
        `,
      }, { emailType: 'test_magic_link' });
      results.magicLink = 'sent';
    } catch (e: any) {
      results.magicLink = `error: ${e.message}`;
    }

    // ── 2. Password Reset test ──────────────────────────────────────────────
    try {
      await sendEmailWithLog(blink, {
        to: toEmail,
        from: SUPPORT_EMAIL,
        replyTo: SUPPORT_EMAIL,
        subject: `[TEST] PocketPull TCG — Reset Your Password`,
        text: [
          `PocketPull TCG — Password Reset`,
          `================================`,
          ``,
          `Hi there,`,
          ``,
          `This is a TEST password reset email from ${SENDER_NAME}.`,
          ``,
          `In production, this would contain a secure password reset link valid for 1 hour.`,
          `If you did not request a password reset, please ignore this email.`,
          ``,
          `— ${SENDER_NAME}`,
          SUPPORT_EMAIL,
        ].join('\n'),
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0e1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
            <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
            <div style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9b5cff;font-weight:700;">${SENDER_NAME}</p>
              <h1 style="margin:0 0 16px;font-size:22px;color:#fff;font-weight:800;">Password Reset [TEST]</h1>
              <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
                This is a <strong style="color:#fff;">TEST email</strong> sent from <strong>${SUPPORT_EMAIL}</strong>.<br>
                In production, this email contains a secure link to reset your password (valid 1 hour).
              </p>
              <div style="background:rgba(155,92,255,0.08);border:1px solid rgba(155,92,255,0.3);border-radius:12px;padding:18px 22px;margin-bottom:24px;">
                <p style="margin:0;color:#9b5cff;font-size:13px;font-weight:700;">✓ Sender verified: ${SUPPORT_EMAIL}</p>
              </div>
              <p style="color:#6b7280;font-size:12px;margin:0;">If you did not request a password reset, you can safely ignore this email.</p>
            </div>
            <div style="padding:14px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
              <p style="margin:0;font-size:12px;color:#4b5563;">© ${SENDER_NAME} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
            </div>
          </div>
        `,
      }, { emailType: 'test_password_reset' });
      results.passwordReset = 'sent';
    } catch (e: any) {
      results.passwordReset = `error: ${e.message}`;
    }

    return c.json({
      success: true,
      from: SUPPORT_EMAIL,
      to: toEmail,
      results,
    });

  } catch (err: any) {
    console.error('[send-test-emails] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;