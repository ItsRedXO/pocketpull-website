import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Shield, Star, Search, Trash2, UserPlus, RefreshCw, AlertCircle } from 'lucide-react';
import { BACKEND_BASE } from '../lib/backend';
import { getAdminAuthHeaders } from './adminAuthHeaders';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'creator';
  created_at: string;
}

interface SearchUser {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string | null;
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_META = {
  owner: {
    label: 'OWNER',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    icon: <Crown size={11} />,
    description: 'Full access to everything. Cannot be removed via panel.',
  },
  admin: {
    label: 'ADMIN',
    color: '#9b5cff',
    bg: 'rgba(155,92,255,0.12)',
    border: 'rgba(155,92,255,0.3)',
    icon: <Shield size={11} />,
    description: 'Full panel access. Can assign/remove creators.',
  },
  creator: {
    label: 'CREATOR',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    icon: <Star size={11} />,
    description: 'Creator badge. Benefits unlocked in a future update.',
  },
} as const;

type RoleKey = keyof typeof ROLE_META;

function RoleBadge({ role }: { role: RoleKey }) {
  const m = ROLE_META[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}
    >
      {m.icon}{m.label}
    </span>
  );
}

function displayName(u: StaffUser | SearchUser) {
  return u.username || u.display_name || u.email || u.id;
}

// ── Main component ────────────────────────────────────────────────────────────

export function RolesTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [callerRole, setCallerRole] = useState<'owner' | 'admin' | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // ── Fetch caller's own role ──────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const h = await getAdminAuthHeaders();
        const r = await fetch(`${BACKEND_BASE}/admin/roles/me`, { headers: h });
        if (r.ok) {
          const j = await r.json();
          setCallerRole(j.role === 'owner' ? 'owner' : 'admin');
        }
      } catch { /* non-critical */ }
    })();
  }, []);

  // ── Fetch staff roster ───────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const h = await getAdminAuthHeaders();
      const r = await fetch(`${BACKEND_BASE}/admin/roles`, { headers: h });
      if (r.ok) setStaff(await r.json().then(j => j.staff || []));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── User search ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const h = await getAdminAuthHeaders();
        const r = await fetch(`${BACKEND_BASE}/admin/roles/search?q=${encodeURIComponent(search)}`, { headers: h });
        if (r.ok) setSearchResults(await r.json().then(j => j.users || []));
      } catch { /* ignore */ } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Assign role ──────────────────────────────────────────────────────────

  async function assignRole(userId: string, role: 'admin' | 'creator') {
    if (assigning) return;
    setAssigning(userId + role);
    try {
      const h = await getAdminAuthHeaders();
      const r = await fetch(`${BACKEND_BASE}/admin/roles/${userId}`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const j = await r.json();
      if (!r.ok) { showToast(j.error || 'Failed to assign role', false); return; }
      showToast(`Role assigned: ${role}`, true);
      setSearch('');
      setSearchResults([]);
      fetchStaff();
    } catch { showToast('Network error', false); } finally {
      setAssigning(null);
    }
  }

  // ── Remove role ──────────────────────────────────────────────────────────

  async function removeRole(userId: string, currentRole: string) {
    if (removing) return;
    if (!confirm(`Remove ${currentRole} role from this user?`)) return;
    setRemoving(userId);
    try {
      const h = await getAdminAuthHeaders();
      const r = await fetch(`${BACKEND_BASE}/admin/roles/${userId}`, {
        method: 'DELETE',
        headers: h,
      });
      const j = await r.json();
      if (!r.ok) { showToast(j.error || 'Failed to remove role', false); return; }
      showToast('Role removed', true);
      fetchStaff();
    } catch { showToast('Network error', false); } finally {
      setRemoving(null);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function canAssignAdmin() { return callerRole === 'owner'; }
  function canAssignCreator() { return callerRole === 'owner' || callerRole === 'admin'; }
  function canRemove(targetRole: string) {
    if (targetRole === 'owner') return false;
    if (targetRole === 'admin') return callerRole === 'owner';
    return true; // creator
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const owners   = staff.filter(s => s.role === 'owner');
  const admins   = staff.filter(s => s.role === 'admin');
  const creators = staff.filter(s => s.role === 'creator');

  return (
    <section className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Staff management</p>
        <h1 className="font-sans text-2xl uppercase text-white">Roles</h1>
        <p className="text-[11px] text-white/30 mt-0.5">
          Assign owner-protected roles. Changes take effect immediately.
        </p>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(ROLE_META) as [RoleKey, typeof ROLE_META[RoleKey]][]).map(([key, m]) => (
          <div
            key={key}
            className="rounded-xl p-4 border"
            style={{ background: m.bg, borderColor: m.border }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: m.color }}>{m.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: m.color }}>{m.label}</span>
            </div>
            <p className="text-[10px] text-white/40">{m.description}</p>
          </div>
        ))}
      </div>

      {/* Assign role — search */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
          <UserPlus size={13} /> Assign Role
        </h2>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search trainer by username or email…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-[#9b5cff]/50"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[#9b5cff]/40 border-t-[#9b5cff] animate-spin" />
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            {searchResults.map(u => {
              const inStaff = staff.find(s => s.id === u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white font-bold truncate">{displayName(u)}</p>
                    {u.email && <p className="text-[9px] text-white/30 truncate">{u.email}</p>}
                  </div>
                  {inStaff && <RoleBadge role={inStaff.role} />}
                  <div className="flex gap-1.5 shrink-0">
                    {canAssignAdmin() && (
                      <button
                        onClick={() => assignRole(u.id, 'admin')}
                        disabled={!!assigning || inStaff?.role === 'admin' || inStaff?.role === 'owner'}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider disabled:opacity-30 transition-all hover:opacity-80"
                        style={{ background: 'rgba(155,92,255,0.15)', color: '#9b5cff', border: '1px solid rgba(155,92,255,0.3)' }}
                      >
                        + Admin
                      </button>
                    )}
                    {canAssignCreator() && (
                      <button
                        onClick={() => assignRole(u.id, 'creator')}
                        disabled={!!assigning || inStaff?.role === 'creator' || inStaff?.role === 'owner'}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider disabled:opacity-30 transition-all hover:opacity-80"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                      >
                        + Creator
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {search.length >= 2 && !searchLoading && searchResults.length === 0 && (
          <p className="text-[11px] text-white/25 text-center py-2">No trainers found for "{search}"</p>
        )}
      </div>

      {/* Staff roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Current Staff</h2>
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-[#9b5cff]/20 border-t-[#9b5cff] animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <AlertCircle size={24} className="text-white/15 mx-auto mb-2" />
            <p className="text-white/25 text-sm">No staff assigned yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
            {[
              { label: 'Owners', users: owners, role: 'owner' as RoleKey },
              { label: 'Admins', users: admins, role: 'admin' as RoleKey },
              { label: 'Creators', users: creators, role: 'creator' as RoleKey },
            ].filter(g => g.users.length > 0).map(group => (
              <div key={group.role}>
                <div
                  className="px-4 py-2 border-b border-white/5"
                  style={{ background: `${ROLE_META[group.role].bg}` }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ROLE_META[group.role].color }}>
                    {group.label} · {group.users.length}
                  </span>
                </div>
                {group.users.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    {/* Avatar placeholder */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{ background: ROLE_META[u.role].bg, color: ROLE_META[u.role].color, border: `1px solid ${ROLE_META[u.role].border}` }}
                    >
                      {(displayName(u)[0] || '?').toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] text-white font-bold truncate">{displayName(u)}</p>
                        <RoleBadge role={u.role} />
                      </div>
                      {u.email && <p className="text-[9px] text-white/30 truncate">{u.email}</p>}
                    </div>

                    {canRemove(u.role) && (
                      <button
                        onClick={() => removeRole(u.id, u.role)}
                        disabled={removing === u.id}
                        className="shrink-0 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30 transition-all"
                        title="Remove role"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
