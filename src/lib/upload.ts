import { getPreferredAuthToken } from './blink';
import { BACKEND_BASE } from './backend';

/** Uploads a file to one of backend/routes/storage.ts's endpoints, returning the resulting public URL. */
export async function uploadFile(path: string, file: File, extraHeaders: Record<string, string> = {}): Promise<string> {
  const headers: Record<string, string> = { ...extraHeaders };
  try {
    const token = await getPreferredAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* unauthenticated requests remain possible */ }

  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BACKEND_BASE}${path}`, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data.publicUrl;
}
