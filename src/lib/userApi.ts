import { blink } from './blink';

const BACKEND_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function headers() {
  const token = await blink.auth.getValidToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_BASE}${path}`, { ...init, headers: { ...(await headers()), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `API error ${response.status}`);
  return data as T;
}

export async function resolveLoginIdentifier(identifier: string): Promise<string> {
  const result = await request<{ email: string }>('/auth/lookup', { method: 'POST', body: JSON.stringify({ identifier }) });
  return result.email;
}

export async function validateSignup(email: string, username: string): Promise<void> {
  await request('/auth/validate-signup', { method: 'POST', body: JSON.stringify({ email, username }) });
}

export async function bootstrapUser(user: { email?: string; username?: string; displayName?: string; avatarUrl?: string; referralCode?: string }) {
  return request<{ success: boolean; user: any }>('/users/bootstrap', { method: 'POST', body: JSON.stringify(user) });
}

export async function fetchCurrentUser() {
  return request<{ user: any }>('/me');
}
