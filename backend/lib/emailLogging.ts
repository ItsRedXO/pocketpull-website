import { uid } from './auth';

type EmailPayload = {
  to: string | string[];
  from?: string;
  subject: string;
  [key: string]: unknown;
};

type EmailLogContext = {
  emailType: string;
  cashoutId?: string;
};

/** Sends an email and records both successful and failed attempts. */
export async function sendEmailWithLog(
  blink: any,
  payload: EmailPayload,
  context: EmailLogContext,
) {
  const recipient = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const sender = payload.from || 'platform-default';
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
    const result = await blink.notifications.email(payload);
    await recordEmail(blink, {
      ...baseLog,
      status: 'success',
      providerMessageId: result?.messageId || null,
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
