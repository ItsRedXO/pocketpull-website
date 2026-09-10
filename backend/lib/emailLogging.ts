import { uid } from './auth';

type EmailPayload = {
  to: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  [key: string]: unknown;
};

type EmailLogContext = {
  emailType: string;
  cashoutId?: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'PocketPull TCG <support@pocketpulltcg.com>';

/**
 * Sends via Resend's API directly. This used to call blink.notifications.email(...),
 * but every call site passes the object returned by getBlinkDb() (just
 * { db: postgresBlinkDb }, no .notifications property at all) -- meaning
 * every transactional email here (cashout confirmations, admin test emails)
 * has been throwing and silently failing this whole time, independent of
 * the Blink migration. Resend replaces it outright rather than restoring a
 * live Blink dependency that was broken anyway.
 */
async function sendViaResend(payload: EmailPayload): Promise<{ messageId: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set in environment');
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: payload.from || DEFAULT_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend API error ${res.status}`);
  return { messageId: data?.id || null };
}

/** Sends an email and records both successful and failed attempts. */
export async function sendEmailWithLog(
  blink: any,
  payload: EmailPayload,
  context: EmailLogContext,
) {
  const recipient = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const sender = payload.from || DEFAULT_FROM;
  const baseLog = {
    id: `email_${uid()}`,
    recipient,
    sender,
    subject: payload.subject,
    emailType: context.emailType,
    sentAt: new Date().toISOString(),
    cashoutId: context.cashoutId || null,
    textContent: typeof payload.text === 'string' ? payload.text : null,
    htmlContent: typeof payload.html === 'string' ? payload.html : null,
  };

  try {
    const result = await sendViaResend(payload);
    await recordEmail(blink, {
      ...baseLog,
      status: 'success',
      providerMessageId: result.messageId,
      errorMessage: null,
    });
    return result;
  } catch (error: any) {
    await recordEmail(blink, {
      ...baseLog,
      status: 'failure',
      providerMessageId: null,
      errorMessage: error?.message || String(error),
    });
    throw error;
  }
}

async function recordEmail(blink: any, row: Record<string, unknown>) {
  try {
    await blink.db.table('outboundEmails').create(row);
  } catch (logError: any) {
    // Logging must never change the existing email behavior or turn a sent
    // email into an application failure.
    console.error('[emailLogging] Failed to record outbound email:', logError?.message || logError);
  }
}
