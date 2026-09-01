import { Hono } from 'hono';
import { generateReferralCode, requireAuth, verifyBlinkIdentity } from '../lib/auth';
import { getDb } from '../db/client';
import { getUserProfile } from '../db/repositories/users';

const app = new Hono();

app.post('/auth/lookup', async (c) => {
  try {
    const body = await c.req.json();
    const identifier = String(body.identifier || '').trim();
    if (!identifier) return c.json({ error: 'Identifier required' }, 400);
    const result = identifier.includes('@')
      ? await getDb(c.env as any).query<any>('SELECT email,is_banned,is_deleted FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [identifier])
      : await getDb(c.env as any).query<any>('SELECT email,is_banned,is_deleted FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(display_name)=LOWER($1) LIMIT 1', [identifier]);
    const user = result.rows[0];
    if (!user || user.is_deleted) return c.json({ error: 'INVALID_CREDENTIALS' }, 404);
    if (user.is_banned) return c.json({ error: 'BANNED_ACCOUNT' }, 403);
    return c.json({ email: user.email });
  } catch { return c.json({ error: 'Invalid request' }, 400); }
});

app.post('/auth/validate-signup', async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim();
    if (!email || !username) return c.json({ error: 'Email and username required' }, 400);
    const emailResult = await getDb(c.env as any).query<any>('SELECT is_banned,is_deleted FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
    if (emailResult.rows[0] && !emailResult.rows[0].is_deleted) {
      if (emailResult.rows[0].is_banned) return c.json({ error: 'EMAIL_BANNED' }, 409);
      return c.json({ error: 'EMAIL_TAKEN' }, 409);
    }
    const usernameResult = await getDb(c.env as any).query<any>('SELECT 1 FROM users WHERE (LOWER(username)=LOWER($1) OR LOWER(display_name)=LOWER($1)) AND is_deleted=FALSE LIMIT 1', [username]);
    if (usernameResult.rows[0]) return c.json({ error: 'USERNAME_TAKEN' }, 409);
    return c.json({ valid: true });
  } catch { return c.json({ error: 'Invalid request' }, 400); }
});

app.post('/users/bootstrap', async (c) => {
  let userId: string;
  try { userId = await verifyBlinkIdentity(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  try {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || body.displayName || '').trim() || `Trainer_${userId.slice(-4)}`;
    const displayName = String(body.displayName || username).trim();
    if (!email) return c.json({ error: 'Email required' }, 400);
    const db = getDb(c.env as any);
    const existing = await db.query<any>('SELECT id FROM users WHERE id=$1 LIMIT 1', [userId]);
    if (existing.rows[0]) {
      await db.query(`UPDATE users SET email=COALESCE(NULLIF($2,''),email),username=COALESCE(NULLIF($3,''),username),display_name=COALESCE(NULLIF($4,''),display_name),avatar_url=COALESCE($5,avatar_url),updated_at=NOW() WHERE id=$1`, [userId, email, username, displayName, body.avatarUrl || null]);
    } else {
      const referralCode = String(body.referralCode || localStorage).trim().toUpperCase();
      let referrerId: string | null = null;
      if (referralCode && referralCode !== 'LOCALSTORAGE') {
        const ref = await db.query<any>('SELECT id FROM users WHERE referral_code=$1 AND id<>$2 LIMIT 1', [referralCode, userId]);
        referrerId = ref.rows[0]?.id || null;
      }
      const ownCode = generateReferralCode();
      await db.query(`INSERT INTO users (id,email,display_name,username,avatar_url,balance,matched_balance,email_verified,role,is_banned,is_bot,referral_code,referred_by_id,referral_reward_paid,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,0,0,TRUE,'user',FALSE,FALSE,$6,$7,FALSE,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`, [userId, email, displayName, username, body.avatarUrl || '', ownCode, referrerId]);
    }
    const user = await getUserProfile(c.env as any, userId);
    return c.json({ success: true, user });
  } catch (err: any) { console.error('[users/bootstrap]', err?.message || err); return c.json({ error: err?.message || 'Failed to bootstrap user' }, 500); }
});

app.get('/me', async (c) => {
  try { const userId = await requireAuth(c); const user = await getUserProfile(c.env as any, userId); return user ? c.json({ user }) : c.json({ error: 'User not found' }, 404); }
  catch (err: any) { return c.json({ error: err?.message || 'Unauthorized' }, err?.message === 'ACCOUNT_DEACTIVATED' || err?.message === 'ACCOUNT_BANNED' ? 403 : 401); }
});

export default app;
