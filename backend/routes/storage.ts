import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { uploadToStorage } from '../lib/supabaseStorage';

const app = new Hono();

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Same dedicated-secret-or-promoted-role check used by backend/routes/adminPacks.ts.
async function requireAdmin(c: any): Promise<string> {
  const secret = c.req.header('X-Admin-Secret');
  if (secret && secret !== 'true') {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return rows[0].id;
  }
  const userId = await requireAuth(c);
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
  return userId;
}

function extOf(name: string, fallback: string) {
  const ext = name.split('.').pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : fallback;
}

async function readUploadedFile(c: any): Promise<File> {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === 'string') throw new Error('No file uploaded');
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Only JPG, PNG, GIF, or WEBP files are allowed.');
  if (file.size > MAX_FILE_SIZE) throw new Error('File is too large.');
  return file;
}

function statusFor(message: string) {
  if (message === 'UNAUTHORIZED') return 401;
  if (message === 'FORBIDDEN' || message === 'ACCOUNT_DEACTIVATED') return 403;
  return 400;
}

app.post('/storage/avatar', async c => {
  try {
    const userId = await requireAuth(c);
    const file = await readUploadedFile(c);
    const publicUrl = await uploadToStorage('avatars', `${userId}_${Date.now()}.${extOf(file.name, 'jpg')}`, file);
    return c.json({ publicUrl });
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, statusFor(error.message));
  }
});

app.post('/storage/cashout-id', async c => {
  try {
    const userId = await requireAuth(c);
    const file = await readUploadedFile(c);
    const publicUrl = await uploadToStorage('cashout-ids', `${userId}_${Date.now()}.${extOf(file.name, 'jpg')}`, file);
    return c.json({ publicUrl });
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, statusFor(error.message));
  }
});

app.post('/admin/storage/pack-image', async c => {
  try {
    await requireAdmin(c);
    const file = await readUploadedFile(c);
    const publicUrl = await uploadToStorage('pack-images', `packs/${Date.now()}.${extOf(file.name, 'png')}`, file);
    return c.json({ publicUrl });
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, statusFor(error.message));
  }
});

app.post('/admin/storage/card-image', async c => {
  try {
    await requireAdmin(c);
    const file = await readUploadedFile(c);
    const path = `cards/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extOf(file.name, 'png')}`;
    const publicUrl = await uploadToStorage('pack-images', path, file);
    return c.json({ publicUrl });
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, statusFor(error.message));
  }
});

export default app;
