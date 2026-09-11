import { Hono } from 'hono';
import { getBlinkDb } from '../lib/auth';
import { query } from '../lib/postgres';
import { generatePasswordResetToken } from '../lib/supabaseAdmin';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';
const SENDER_NAME = 'PocketPull TCG';
const DEFAULT_ORIGIN = 'https://pocketpulltcg.com';

/**
 * POST /auth/password-reset
 *
 * Replaces the old dual-send in src/hooks/useAuth.ts (Blink's own reset
 * email + Supabase's built-in `resetPasswordForEmail` mailer), which
 * produced two separate, confusing emails and neither link reliably worked:
 * Blink's redirected to our /reset-password page but that page only ever
 * understands a Supabase recovery session, so it hung forever on "Verifying
 * your reset link...", and Supabase's own mailer/redirect depends on the
 * project's Redirect URL allow-list being correctly configured.
 *
 * This sends exactly one email, via Resend, from our own domain. It embeds
 * a Supabase recovery token generated server-side (see
 * generatePasswordResetToken in ../lib/supabaseAdmin) as a `token_hash`
 * query param that /reset-password resolves itself via
 * `supabase.auth.verifyOtp()` -- no dependency on Supabase's hosted verify
 * redirect or its email templates at all.
 *
 * Always responds { success: true } regardless of whether the email is
 * registered, to avoid leaking account existence.
 */
app.post('/auth/password-reset', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const origin = typeof body.origin === 'string' && body.origin ? body.origin.replace(/\/$/, '') : DEFAULT_ORIGIN;

  if (email) {
    try {
      const rows = await query<{ id: string; auth_user_id: string | null }>(
        'SELECT id, auth_user_id FROM users WHERE lower(email)=$1 AND is_deleted=0 LIMIT 1',
        [email]
      );
      const account = rows[0];
      if (account) {
        const { tokenHash, authUserId } = await generatePasswordResetToken(email);
        if (!account.auth_user_id) {
          await query('UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL', [authUserId, account.id]).catch((err: any) => {
            if (err?.code !== '23505') throw err; // already linked elsewhere -- not this request's problem
          });
        }

        const resetUrl = `${origin}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
        await sendEmailWithLog(getBlinkDb(), {
          to: email,
          from: `${SENDER_NAME} <${SUPPORT_EMAIL}>`,
          replyTo: SUPPORT_EMAIL,
          subject: 'Reset your PocketPull TCG password',
          text: [
            `PocketPull TCG — Password Reset`,
            `================================`,
            ``,
            `We received a request to reset your password. Follow the link below to choose a new one (valid for 1 hour):`,
            ``,
            resetUrl,
            ``,
            `If you didn't request this, you can safely ignore this email.`,
            ``,
            `— ${SENDER_NAME}`,
            SUPPORT_EMAIL,
          ].join('\n'),
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0e1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
              <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
              <div style="padding:32px 36px;">
                <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9b5cff;font-weight:700;">${SENDER_NAME}</p>
                <h1 style="margin:0 0 16px;font-size:22px;color:#fff;font-weight:800;">Reset your password</h1>
                <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
                  We received a request to reset your password. Click the button below to choose a new one. This link is valid for 1 hour.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td bgcolor="#00c8ff" align="center" style="background-color:#00c8ff;border-radius:10px;">
                      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-family:sans-serif;font-size:14px;font-weight:700;color:#04121a;text-decoration:none;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="color:#6b7280;font-size:12px;margin:0 0 16px;">Or copy and paste this link into your browser: <a href="${resetUrl}" style="color:#00c8ff;">${resetUrl}</a></p>
                <p style="color:#6b7280;font-size:12px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
              </div>
              <div style="padding:14px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
                <p style="margin:0;font-size:12px;color:#4b5563;">© ${SENDER_NAME} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
              </div>
            </div>
          `,
        }, { emailType: 'password_reset' });
      }
    } catch (err: any) {
      console.error('[auth/password-reset] error:', err?.message || err);
    }
  }

  return c.json({ success: true });
});

export default app;
