import React, { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

function headers() {
  const out: Record<string, string> = { 'Content-Type': 'application/json' };
  try { const secret = localStorage.getItem('pocketpull_admin_pass'); if (secret) out['X-Admin-Secret'] = secret; } catch {}
  return out;
}

async function getStats() {
  const h = headers();
  try { const token = await blink.auth.getValidToken(); if (token) h.Authorization = `Bearer ${token}`; } catch {}
  const response = await fetch(`${BACKEND_BASE}/admin/stats`, { headers: h });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Stats request failed (${response.status})`);
  return payload;
}

export function StatsTabFixed() {
  const qc = useQueryClient();
  const { data: stats, isLoading, isFetching, error } = useQuery({ queryKey: ['admin-stats-fixed'], queryFn: getStats, staleTime: 0, refetchInterval: 10000 });
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ['admin-stats-fixed'] }); }, [qc]);
  const cards = [
    ['Total Users', Number(stats?.totalUsers || 0).toLocaleString(), '#9b5cff'],
    ['Packs Opened', Number(stats?.totalPulls || 0).toLocaleString(), '#00c8ff'],
    ['Total Deposits', `$${Number(stats?.totalRevenue || 0).toFixed(2)}`, '#10b981'],
    ['User Balances', `$${Number(stats?.totalBalance || 0).toFixed(2)}`, '#f59e0b'],
    ['Active Packs', Number(stats?.activePacks || 0).toLocaleString(), '#ff00ff'],
    ['Total Packs', Number(stats?.totalPacks || 0).toLocaleString(), '#8892a4'],
  ];

  return <section className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="font-display text-xl uppercase tracking-wider text-white">Site Statistics</h2><p className="text-[11px] text-white/30 mt-0.5">Live PostgreSQL aggregates — no client-side 500-row cap</p></div><button onClick={refresh} disabled={isFetching} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 disabled:opacity-30"><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /></button></div>
    {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">{(error as Error).message}</div>}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{cards.map(([label, value, color]) => <div key={label} className="rounded-2xl p-4 text-center" style={{ background: `${color}08`, border: `1.5px solid ${color}22` }}><p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">{label}</p><p className="text-2xl font-display font-bold" style={{ color }}>{isLoading ? '—' : value}</p></div>)}</div>
    {stats?.packBreakdown?.length > 0 && <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}><h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display mb-3">Pack Performance</h3><div className="flex flex-col gap-2">{stats.packBreakdown.map((p: any) => <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}><span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ color: p.active ? '#10b981' : '#ffffff40', background: p.active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)' }}>{p.active ? 'LIVE' : 'OFF'}</span><span className="text-[12px] text-white flex-1 truncate">{p.name}</span><span className="text-[11px] text-white/40">${Number(p.price).toFixed(2)}</span><span className="text-[12px] font-bold text-[#00c8ff]">{Number(p.opens).toLocaleString()} opens</span><span className="text-[11px] font-bold text-[#10b981]">${(Number(p.opens) * Number(p.price)).toFixed(2)}</span></div>)}</div></div>}
  </section>;
}
