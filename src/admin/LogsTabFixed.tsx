import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, Filter, X, ChevronLeft, ChevronRight, Shield, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

interface LogEntry {
  id: string;
  type: string;
  userId: string | null;
  username: string;
  action: string;
  details: Record<string, any>;
  valueIn: number;
  valueOut: number;
  result: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  pack_open: { label: 'Pack Opening', color: '#00c8ff' },
  upgrade: { label: 'Upgrader', color: '#9b5cff' },
  exchange: { label: 'Exchanger', color: '#f59e0b' },
  battle: { label: 'Battle', color: '#ef4444' },
  sell: { label: 'Card Sale', color: '#10b981' },
  deposit: { label: 'Deposit', color: '#22d3ee' },
  cashout: { label: 'Cashout', color: '#fcd34d' },
  admin: { label: 'Admin', color: '#f87171' },
};

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const secret = localStorage.getItem('pocketpull_admin_pass');
    if (secret) headers['X-Admin-Secret'] = secret;
  } catch {}
  return headers;
}

async function authHeadersWithToken() {
  const headers = authHeaders();
  try {
    const token = await blink.auth.getValidToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resultMeta(result: string | null) {
  if (result === 'win' || result === 'success' || result === 'sold' || result === 'sold_all' || result === 'completed') return { icon: <CheckCircle size={11} />, color: '#10b981' };
  if (result === 'loss') return { icon: <XCircle size={11} />, color: '#ef4444' };
  if (result === 'pending') return { icon: <AlertCircle size={11} />, color: '#f59e0b' };
  return { icon: <Shield size={11} />, color: '#9ca3af' };
}

export function LogsTabFixed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const headers = await authHeadersWithToken();
      const response = await fetch(`${BACKEND_BASE}/admin/logs?${params}`, { headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setTotal(Number(payload.total) || 0);
      setTotalPages(Math.max(1, Number(payload.totalPages) || 1));
    } catch (e: any) {
      setError(e?.message || 'Failed to load admin logs');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page, search, type]);

  useEffect(() => { void load(page); }, [load, page]);

  const applyFilters = () => {
    setPage(1);
    void load(1);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Audit trail</p>
          <h1 className="font-display text-2xl uppercase text-white">Admin Logs</h1>
          <p className="text-[11px] text-white/30 mt-0.5">PostgreSQL-backed activity history</p>
        </div>
        <button onClick={() => void load(page)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_180px_150px_150px_auto]">
        <label className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilters()} placeholder="Search user, action, details" className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-[#9b5cff]/50" />
        </label>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none">
          <option value="">All types</option>
          {Object.entries(TYPE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/60 outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/60 outline-none" />
        <button onClick={applyFilters} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#9b5cff]/25 bg-[#9b5cff]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9b5cff] hover:bg-[#9b5cff]/15"><Filter size={12} /> Apply</button>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[110px_1fr_1.4fr_110px_1fr_90px] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30 md:grid">
          <span>Type</span><span>User</span><span>Action</span><span>Result</span><span>Time</span><span>Value</span>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-white/30">Loading audit history...</div> : logs.length === 0 ? <div className="p-12 text-center text-sm text-white/30">No log entries match these filters.</div> : logs.map(log => {
          const meta = TYPE_META[log.type] || { label: log.type || 'Unknown', color: '#9ca3af' };
          const result = resultMeta(log.result);
          const value = Number(log.valueOut || log.valueIn || 0);
          return (
            <button key={log.id} onClick={() => setSelected(log)} className="grid w-full gap-2 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[110px_1fr_1.4fr_110px_1fr_90px] md:items-center">
              <span className="text-[10px] font-bold uppercase" style={{ color: meta.color }}>{meta.label}</span>
              <span className="truncate text-xs text-white/70">{log.username || log.userId || 'System'}</span>
              <span className="truncate text-xs text-white">{log.action}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: result.color }}>{result.icon}{log.result || '—'}</span>
              <span className="text-[10px] text-white/35">{formatDate(log.createdAt)}</span>
              <span className="text-xs font-bold" style={{ color: value ? '#10b981' : '#ffffff40' }}>{value ? `$${value.toFixed(2)}` : '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/30">{total.toLocaleString()} total entries · Page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 disabled:opacity-30"><ChevronLeft size={13} /></button>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 disabled:opacity-30"><ChevronRight size={13} /></button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div><p className="text-[10px] uppercase tracking-widest text-[#9b5cff]">Log details</p><h2 className="text-lg font-bold text-white">{selected.action}</h2></div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"><X size={17} /></button>
            </div>
            <div className="max-h-[calc(85vh-72px)] overflow-y-auto p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Meta label="Type" value={selected.type} />
                <Meta label="User" value={selected.username || selected.userId || 'System'} />
                <Meta label="Result" value={selected.result || '—'} />
                <Meta label="Created" value={formatDate(selected.createdAt)} />
                <Meta label="Value In" value={`$${Number(selected.valueIn || 0).toFixed(2)}`} />
                <Meta label="Value Out" value={`$${Number(selected.valueOut || 0).toFixed(2)}`} />
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-white/65">{JSON.stringify({ details: selected.details || {}, metadata: selected.metadata || {} }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3"><p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">{label}</p><p className="break-words text-xs text-white/75">{value}</p></div>;
}
