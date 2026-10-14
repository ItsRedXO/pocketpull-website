import { Hono } from 'hono';
import { query } from '../lib/postgres';
import { resolveUserId } from '../lib/auth';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';

const app = new Hono();

// Returns { callerId, callerRole } where callerRole is 'owner' | 'admin' | null
async function resolveCallerRole(c: any): Promise<{ callerId: string | null; callerRole: 'owner' | 'admin' | null }> {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return { callerId: null, callerRole: 'admin' };
  }

  const userId = await resolveUserId(c);
  if (!userId) return { callerId: null, callerRole: null };

  const rows = await query<{ role: string; is_admin: number }>('SELECT role, is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const u = rows[0];
  if (!u) return { callerId: userId, callerRole: null };
  if (u.role === 'owner') return { callerId: userId, callerRole: 'owner' };
  if (u.role === 'admin' || Number(u.is_admin) === 1) return { callerId: userId, callerRole: 'admin' };
  return { callerId: userId, callerRole: null };
}

// GET /admin/roles/me — returns caller's role for the frontend to drive UI
app.get('/admin/roles/me', async c => {
  try {
    const { callerRole } = await resolveCallerRole(c);
    if (!callerRole) return c.json({ error: 'Unauthorized' }, 401);
    return c.json({ role: callerRole });
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
});

// GET /admin/roles — list all staff (owner, admin, creator)
app.get('/admin/roles', async c => {
  try {
    const { callerRole } = await resolveCallerRole(c);
    if (!callerRole) return c.json({ error: 'Unauthorized' }, 401);

    const rows = await query<any>(
      `SELECT id, username, display_name, email, role, created_at
       FROM users
       WHERE role IN ('owner','admin','creator')
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         created_at ASC`,
    );
    return c.json({ staff: rows });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Failed to load roles' }, 500);
  }
});

// GET /admin/roles/search?q=... — search users by username or email
app.get('/admin/roles/search', async c => {
  try {
    const { callerRole } = await resolveCallerRole(c);
    if (!callerRole) return c.json({ error: 'Unauthorized' }, 401);

    const q = (c.req.query('q') || '').trim();
    if (!q || q.length < 2) return c.json({ users: [] });

    const rows = await query<any>(
      `SELECT id, username, display_name, email, role
       FROM users
       WHERE (COALESCE(username,'') ILIKE $1 OR COALESCE(email,'') ILIKE $1)
         AND COALESCE(is_deleted,0)=0
       ORDER BY username ASC
       LIMIT 20`,
      [`%${q}%`],
    );
    return c.json({ users: rows });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Search failed' }, 500);
  }
});

// POST /admin/roles/:userId — assign a role
// body: { role: 'admin' | 'creator' }
app.post('/admin/roles/:userId', async c => {
  try {
    const { callerRole } = await resolveCallerRole(c);
    if (!callerRole) return c.json({ error: 'Unauthorized' }, 401);

    const targetId = c.req.param('userId');
    const body = await c.req.json<{ role?: string }>().catch(() => ({}));
    const newRole = String(body.role || '').toLowerCase();

    if (!['admin', 'creator'].includes(newRole)) {
      return c.json({ error: 'Invalid role. Allowed: admin, creator' }, 400);
    }
    if (newRole === 'admin' && callerRole !== 'owner') {
      return c.json({ error: 'Only owners can assign the admin role' }, 403);
    }

    // Fetch target to prevent touching owners
    const targetRows = await query<{ role: string }>('SELECT role FROM users WHERE id=$1 LIMIT 1', [targetId]);
    if (!targetRows[0]) return c.json({ error: 'User not found' }, 404);
    if (targetRows[0].role === 'owner') {
      return c.json({ error: 'Cannot change the owner role' }, 403);
    }

    await query('UPDATE users SET role=$1 WHERE id=$2', [newRole, targetId]);
    return c.json({ success: true, role: newRole });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Failed to assign role' }, 500);
  }
});

// DELETE /admin/roles/:userId — remove a role (sets to null)
app.delete('/admin/roles/:userId', async c => {
  try {
    const { callerRole } = await resolveCallerRole(c);
    if (!callerRole) return c.json({ error: 'Unauthorized' }, 401);

    const targetId = c.req.param('userId');
    const targetRows = await query<{ role: string }>('SELECT role FROM users WHERE id=$1 LIMIT 1', [targetId]);
    if (!targetRows[0]) return c.json({ error: 'User not found' }, 404);

    const targetRole = targetRows[0].role;
    if (targetRole === 'owner') return c.json({ error: 'Cannot remove owner role' }, 403);
    if (targetRole === 'admin' && callerRole !== 'owner') {
      return c.json({ error: 'Only owners can remove admin role' }, 403);
    }

    await query('UPDATE users SET role=NULL WHERE id=$1', [targetId]);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Failed to remove role' }, 500);
  }
});

export default app;
