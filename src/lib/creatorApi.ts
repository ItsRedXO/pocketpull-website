import { getPreferredAuthToken } from './blink';
import { BACKEND_BASE } from './backend';

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try { const t = await getPreferredAuthToken(); if (t) h.Authorization = `Bearer ${t}`; } catch { /* ok */ }
  return h;
}

export interface CreatorReferral {
  id: string;
  username: string;
  signedUpAt: string;
  firstDepositAmount: number | null;
  hasDeposited: boolean;
  payoutEarned: number;
  rewardPaid: boolean;
}

export interface CreatorDashboardData {
  referralCode: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalEarned: number;
  totalPaidOut: number;
  availableForPayout: number;
  canRequestPayout: boolean;
  hasPendingRequest: boolean;
  referrals: CreatorReferral[];
}

export async function fetchCreatorDashboard(): Promise<CreatorDashboardData> {
  const res = await fetch(`${BACKEND_BASE}/creator/dashboard`, { headers: await authHeaders() });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as CreatorDashboardData;
}

export async function requestCreatorPayout(paymentMethod: string, paymentDetails: string): Promise<{ success: boolean; requestId: string; amount: number }> {
  const res = await fetch(`${BACKEND_BASE}/creator/request-payout`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ paymentMethod, paymentDetails }) });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export interface AdminPayoutRequest {
  id: string;
  creator_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_method: string;
  payment_details: string;
  created_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  username: string;
  email: string;
}

export async function fetchAdminCreatorPayouts(adminHeaders: Record<string, string>): Promise<AdminPayoutRequest[]> {
  const res = await fetch(`${BACKEND_BASE}/admin/creator-payouts`, { headers: adminHeaders });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data.requests as AdminPayoutRequest[];
}

export async function updateCreatorPayoutStatus(id: string, status: string, adminNotes: string, adminHeaders: Record<string, string>): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/admin/creator-payouts/${encodeURIComponent(id)}/status`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status, adminNotes }) });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
}

export interface DailyAllowanceData {
  used: number;
  limit: number;
  remaining: number;
  pstDate: string;
}

export async function fetchDailyAllowance(): Promise<DailyAllowanceData> {
  const res = await fetch(`${BACKEND_BASE}/creator/daily-allowance`, { headers: await authHeaders() });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as DailyAllowanceData;
}

export async function applyDailyAllowance(amount: number): Promise<DailyAllowanceData> {
  const res = await fetch(`${BACKEND_BASE}/creator/daily-allowance/apply`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ amount }) });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return { used: data.used, limit: data.limit, remaining: data.remaining, pstDate: '' };
}
