import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase Storage access (service_role key). Replaces
 * blink.storage.upload for avatars, pack/card images, and cashout ID
 * uploads -- see backend/lib/supabaseAdmin.ts for why
 * SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser. Writes go
 * through this service-role client (bypasses bucket RLS entirely), so the
 * three buckets (avatars, pack-images, cashout-ids) need no storage policies
 * -- only their `public` flag, which controls anonymous reads.
 */

let storageClient: SupabaseClient | undefined;

function getStorageClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required for Supabase storage');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Supabase storage');
  if (!storageClient) {
    storageClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return storageClient;
}

export async function uploadToStorage(bucket: string, path: string, file: File): Promise<string> {
  const client = getStorageClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
