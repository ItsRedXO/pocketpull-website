import { createHmac } from 'crypto';

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'pocketpull-unsub-fallback';
}

export function signUnsubscribeToken(userId: string): string {
  const sig = createHmac('sha256', secret()).update(userId).digest('base64url');
  return Buffer.from(`${userId}|${sig}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const pipeIdx = decoded.lastIndexOf('|');
    if (pipeIdx < 0) return null;
    const userId = decoded.slice(0, pipeIdx);
    const sig = decoded.slice(pipeIdx + 1);
    const expected = createHmac('sha256', secret()).update(userId).digest('base64url');
    if (sig !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

export function makeUnsubscribeUrl(userId: string): string {
  const base = (process.env.SITE_URL || 'https://pocketpulltcg.com').replace(/\/$/, '');
  return `${base}/unsubscribe?token=${signUnsubscribeToken(userId)}`;
}
