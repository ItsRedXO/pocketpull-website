import { Hono } from 'hono';
import { getBlinkServer, requireAuth, generateReferralCode } from '../lib/auth';

const app = new Hono();
function database(c: any) { return getBlinkServer(c.env as any).db; }

app.get('/me', async c => {
  try {
    const userId = await requireAuth(c);
    const db = database(c);
    let user = await db.users.get(userId) as any;
    const email = c.req.header('X-User-Email') || '';
    const displayName = c.req.header('X-User-Display-Name') || '';
    if (!user) {
      const name = displayName || `Trainer_${userId.slice(-4)}`;
      user = await db.users.create({ id: userId, balance: 0, matchedBalance: 0, displayName: name, username: name, email, avatarUrl: '', emailVerified: 1, verifiedAt: new Date().toISOString(), verificationMethod: 'automatic_signup', role: '', isBanned: 0, isDeleted: 0, referralCode: generateReferralCode(), referralRewardPaid: 0 });
    }
    return c.json({ user });
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
});

app.get('/balance', async c => {
  try { const userId = await requireAuth(c); const user = await database(c).users.get(userId) as any; if (!user) return c.json({ error: 'User not found' }, 404); return c.json({ balance: Number(user.balance) || 0, matchedBalance: Number(user.matchedBalance ?? user.matched_balance ?? 0) || 0 }); }
  catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); }
});

app.patch('/me', async c => {
  try { const userId = await requireAuth(c); const body = await c.req.json().catch(() => ({})); const allowed = ['displayName', 'avatarUrl', 'email', 'username']; const updates = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key))); if (!Object.keys(updates).length) return c.json({ error: 'No profile fields supplied' }, 400); const user = await database(c).users.update(userId, updates) as any; return c.json({ user }); }
  catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: err.message || 'Failed to update profile' }, 500); }
});

app.get('/auth/resolve-login', async c => {
  try { const identifier = (c.req.query('identifier') || '').trim(); if (!identifier) return c.json({ error: 'Identifier required' }, 400); const db = database(c); const rows = identifier.includes('@') ? await db.users.list({ where: { email: identifier.toLowerCase() }, limit: 1 }) : await db.users.list({ where: { username: identifier }, limit: 1 }); const user = (rows as any[])[0]; if (!user || Number(user.isDeleted ?? user.is_deleted ?? 0) > 0) return c.json({ error: 'INVALID_CREDENTIALS' }, 404); if (Number(user.isBanned ?? user.is_banned ?? 0) > 0) return c.json({ error: 'BANNED_ACCOUNT' }, 403); if (!user.email) return c.json({ error: 'INVALID_CREDENTIALS' }, 404); return c.json({ email: user.email }); }
  catch { return c.json({ error: 'INVALID_CREDENTIALS' }, 404); }
});

app.get('/auth/check-signup', async c => {
  try { const email = (c.req.query('email') || '').trim().toLowerCase(); const username = (c.req.query('username') || '').trim(); const db = database(c); if (email) { const rows = await db.users.list({ where: { email }, limit: 5 }); if ((rows as any[]).some(r => Number(r.isDeleted ?? r.is_deleted ?? 0) === 0 && Number(r.isBanned ?? r.is_banned ?? 0) > 0)) return c.json({ error: 'EMAIL_BANNED' }, 403); } if (username) { const rows = await db.users.list({ where: { username }, limit: 5 }); if ((rows as any[]).some(r => Number(r.isDeleted ?? r.is_deleted ?? 0) === 0)) return c.json({ error: 'USERNAME_TAKEN' }, 409); const displayRows = await db.users.list({ where: { displayName: username }, limit: 5 }); if ((displayRows as any[]).some(r => Number(r.isDeleted ?? r.is_deleted ?? 0) === 0)) return c.json({ error: 'USERNAME_TAKEN' }, 409); } return c.json({ available: true }); }
  catch (err: any) { return c.json({ error: err.message || 'Signup check failed' }, 500); }
});

export default app;
