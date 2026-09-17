import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

async function adminHeaders(): Promise<Record<string, string>> {
  const token = await blink.auth.getValidToken();
  const secret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(secret ? { 'X-Admin-Secret': secret } : {}),
  };
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { headers: await adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}
async function adminSend<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { method, headers: await adminHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  rewardAmount: number;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchPromoCodes = () => adminGet<{ codes: PromoCode[] }>('/admin/promo-codes');

export interface CreatePromoCodeInput {
  code: string;
  description?: string | null;
  rewardAmount: number;
  maxUses?: number | null;
  expiresAt?: string | null;
}
export const createPromoCode = (input: CreatePromoCodeInput) => adminSend<{ success: boolean; promoCode: PromoCode }>('/admin/promo-codes', 'POST', input);

export interface UpdatePromoCodeInput {
  description?: string | null;
  rewardAmount?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}
export const updatePromoCode = (id: string, fields: UpdatePromoCodeInput) => adminSend<{ success: boolean; promoCode: PromoCode }>(`/admin/promo-codes/${encodeURIComponent(id)}`, 'PATCH', fields);

export interface PromoCodeRedemption {
  userId: string;
  username: string | null;
  email: string | null;
  amount: number;
  redeemedAt: string;
}
export const fetchPromoCodeRedemptions = (id: string) => adminGet<{ redemptions: PromoCodeRedemption[] }>(`/admin/promo-codes/${encodeURIComponent(id)}/redemptions`);

export interface DealSettings {
  depositMatchPercent: number;
  depositMatchCap: number;
  referralRewardAmount: number;
  updatedAt: string;
}
export const fetchDealSettings = () => adminGet<DealSettings>('/admin/deal-settings');
export const patchDealSettings = (fields: Partial<Omit<DealSettings, 'updatedAt'>>) => adminSend<{ success: boolean; settings: DealSettings }>('/admin/deal-settings', 'PATCH', fields);
