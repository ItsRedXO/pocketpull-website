import { uid } from './auth';
import { createActivityLog } from '../db/repositories/activityLogs';

type EmailPayload = { to: string | string[]; from?: string; subject: string; [key: string]: unknown };
type EmailLogContext = { emailType: string; cashoutId?: string };

export async function sendEmailWithLog(blink: any, payload: EmailPayload, context: EmailLogContext) {
  const env = blink?.__pocketpullEnv;
  const recipient = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const base = { id: `email_${uid()}`, recipient, sender: payload.from || 'platform-default', subject: payload.subject, emailType: context.emailType, cashoutId: context.cashoutId || null, textContent: typeof payload.text === 'string' ? payload.text : null, htmlContent: typeof payload.html === 'string' ? payload.html : null };
  try {
    const result = await blink.notifications.email(payload);
    if (env) await createActivityLog(env, { id: base.id, type: 'email', userId: null, username: 'System', action: 'Outbound Email', details: { ...base, status: 'success', providerMessageId: result?.messageId || null }, result: 'success', metadata: { cashoutId: context.cashoutId || null } });
    return result;
  } catch (error: any) {
    if (env) await createActivityLog(env, { id: base.id, type: 'email', userId: null, username: 'System', action: 'Outbound Email', details: { ...base, status: 'failure', errorMessage: error?.message || String(error) }, result: 'failure', metadata: { cashoutId: context.cashoutId || null } }).catch(() => undefined);
    throw error;
  }
}
