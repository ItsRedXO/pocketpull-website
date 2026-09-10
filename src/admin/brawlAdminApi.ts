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

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, { method, headers: await adminHeaders(), body: body !== undefined ? JSON.stringify(body) : undefined });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || `Admin API error ${res.status}`);
  return payload as T;
}

export const adminGet = <T>(path: string) => request<T>(path, 'GET');
export const adminPost = <T>(path: string, body?: unknown) => request<T>(path, 'POST', body);
export const adminPatch = <T>(path: string, body?: unknown) => request<T>(path, 'PATCH', body);
export const adminPut = <T>(path: string, body?: unknown) => request<T>(path, 'PUT', body);
export const adminDelete = <T>(path: string) => request<T>(path, 'DELETE');

export interface AdminBrawlSpecies {
  id: number; name: string; primary_type: string; secondary_type: string | null;
  base_hp: number; base_attack: number; base_defense: number; base_sp_attack: number; base_sp_defense: number; base_speed: number;
  overall_rating: number; evolution_stage: number; sprite_url: string | null; artwork_url: string | null;
}
export interface AdminBrawlUserSummary {
  user_id: string; username: string | null; avatar_url: string | null; league_rating: number; wins: number; losses: number; roster_count: string;
}
export interface AdminBrawlProfile {
  user_id: string; has_completed_intro: number; league: string; league_rating: number; wins: number; losses: number;
  local_battles_played: number; local_tournament_wins: number; state_tournament_wins: number; regional_tournament_wins: number; elite_four_wins: number;
}
export interface AdminBrawlInstance extends Omit<AdminBrawlSpecies, 'id'> {
  id: string; species_id: number; nickname: string | null; source: string; is_on_team: number; team_slot: number | null; acquired_at: string;
}
export interface AdminBrawlUserDetail {
  user: { id: string; username: string | null; avatar_url: string | null };
  profile: AdminBrawlProfile;
  balance: number;
  roster: AdminBrawlInstance[];
}

export const searchAdminBrawlUsers = (search: string) => adminGet<{ users: AdminBrawlUserSummary[] }>(`/admin/brawl/users?search=${encodeURIComponent(search)}`);
export const getAdminBrawlUser = (userId: string) => adminGet<AdminBrawlUserDetail>(`/admin/brawl/users/${encodeURIComponent(userId)}`);
export const patchAdminBrawlProfile = (userId: string, fields: Partial<AdminBrawlProfile>) => adminPatch<{ success: boolean; profile: AdminBrawlProfile }>(`/admin/brawl/users/${encodeURIComponent(userId)}/profile`, fields);
export const adjustAdminBrawlWallet = (userId: string, amount: number, reason?: string) => adminPost<{ success: boolean; balance: number }>(`/admin/brawl/users/${encodeURIComponent(userId)}/wallet`, { amount, reason });
export const grantAdminBrawlInstance = (userId: string, speciesId: number) => adminPost<{ success: boolean; instanceId: string; roster: AdminBrawlInstance[] }>(`/admin/brawl/users/${encodeURIComponent(userId)}/instances`, { speciesId });
export const deleteAdminBrawlInstance = (userId: string, instanceId: string) => adminDelete<{ success: boolean; roster: AdminBrawlInstance[] }>(`/admin/brawl/users/${encodeURIComponent(userId)}/instances/${encodeURIComponent(instanceId)}`);
export const setAdminBrawlTeam = (userId: string, instanceIds: string[]) => adminPut<{ success: boolean; roster: AdminBrawlInstance[] }>(`/admin/brawl/users/${encodeURIComponent(userId)}/team`, { instanceIds });
export const getAdminBrawlSpecies = () => adminGet<{ species: AdminBrawlSpecies[] }>('/admin/brawl/species');
