import { uid } from './auth';
import { getDb } from '../db/client';

type EmailPayload = { to: string | string[]; from?: string; subject: string; [key: string]: unknown };
type EmailLogContext = { emailType: string; cashoutId?: string };

async function recordEmail(env: any, row: { id: string; recipient: string; subject: string; template: string; status: string; providerId?: string | null; metadata?: Record<string, unknown> }) {
  if (!env) return;
  await getDb(env).query(`INSERT INTO outbound_emails (id,to_email,subject,template,status,provider_id,metadata,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW()) ON CONFLICT (id) DO NOTHING`, [row.id, row.recipient, row.subject, row.template, row.status, row.providerId || null, JSON.stringify(row.metadata || {})]);
}

export async function sendEmailWithLog(blink: any, payload: EmailPayload, context: EmailLogContext) {
  const env = blink?.__pocketpullEnv;
  const recipient = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const id = `email_${uid()}`;
  try {
    const result = await blink.notifications.email(payload);
    await recordEmail(env, { id, recipient, subject: payload.subject, template: context.emailType, status: 'success', providerId: result?.messageId || null, metadata: { cashoutId: context.cashoutId || null, from: payload.from || null } }).catch(err => console.error('[emailLogging] audit write failed:', err?.message || err));
    return result;
  } catch (error: any) {
    await recordEmail(env, { id, recipient, subject: payload.subject, template: context.emailType, status: 'failure', providerId: null, metadata: { cashoutId: context.cashoutId || null, errorMessage: error?.message || String(error), from: payload.from || null } }).catch(err => console.error('[emailLogging] audit write failed:', err?.message || err));
    throw error;
  }
}
