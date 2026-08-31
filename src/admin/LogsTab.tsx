import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Filter, Package, TrendingUp, ArrowLeftRight,
  Swords, ShoppingCart, CreditCard, Banknote, Shield, ChevronLeft,
  ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, X,
} from 'lucide-react';

const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

// ── Types ──────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  type: string;
  userId: string | null;
  username: string;
  action: string;
  details: string; // JSON string
  valueIn: number;
  valueOut: number;
  result: string | null;
  metadata: string;
  createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
const LOG_TYPES = [
  { id: '', label: 'All Types' },
  { id: 'pack_open', label: 'Pack Openings' },
  { id: 'upgrade', label: 'Upgrader' },
  { id: 'exchange', label: 'Exchanger' },
  { id: 'battle', label: 'Pack Battles' },
  { id: 'sell', label: 'Card Sales' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'cashout', label: 'Cash Outs' },
  { id: 'admin', label: 'Admin Actions' },
];

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  pack_open:  { icon: <Package size={12} />,       color: '#00c8ff', bg: 'rgba(0,200,255,0.1)' },
  upgrade:    { icon: <TrendingUp size={12} />,     color: '#9b5cff', bg: 'rgba(155,92,255,0.1)' },
  exchange:   { icon: <ArrowLeftRight size={12} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  battle:     { icon: <Swords size={12} />,         color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  sell:       { icon: <ShoppingCart size={12} />,   color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  deposit:    { icon: <CreditCard size={12} />,     color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  cashout:    { icon: <Banknote size={12} />,       color: '#fcd34d', bg: 'rgba(252,211,77,0.1)' },
  admin:      { icon: <Shield size={12} />,         color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const RESULT_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  win:           { icon: <CheckCircle size={11} />, color: '#10b981' },
  success:       { icon: <CheckCircle size={11} />, color: '#10b981' },
  sold:          { icon: <CheckCircle size={11} />, color: '#10b981' },
  sold_all:      { icon: <CheckCircle size={11} />, color: '#10b981' },
  kept:          { icon: <CheckCircle size={11} />, color: '#00c8ff' },
  completed:     { icon: <CheckCircle size={11} />, color: '#10b981' },
  loss:          { icon: <XCircle size={11} />,     color: '#ef4444' },
  pending:       { icon: <AlertCircle size={11} />, color: '#f59e0b' },
  admin_action:  { icon: <Shield size={11} />,      color: '#f87171' },
};

function fmt(date: string) {
  try {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return date; }
}

function parseDetails(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Detail Expander ────────────────────────────────────────────────────────
function LogDetail({ log }: { log: LogEntry }) {
  const d = parseDetails(log.details);
  const type = log.type;

  if (type === 'pack_open') {
    return (
      <div className="space-y-1">
        <Row label="Pack" value={d.packName} />
        <Row label="Cost" value={`$${Number(d.packCost || 0).toFixed(2)}`} />
        <Row label="Card Won" value={d.cardWon} bold />
        <Row label="Card Value" value={`$${Number(d.cardValue || 0).toFixed(2)}`} highlight />
        <Row label="Rarity" value={d.rarity} />
        <Row label="Action" value={d.action === 'sell' ? 'Sold immediately' : 'Kept in inventory'} />
      </div>
    );
  }
  if (type === 'upgrade') {
    const usedCards = d.cardsUsed || [];
    const targets = d.targetCards || [];
    const prizes = d.prizeReceived || [];
    return (
      <div className="space-y-1">
        <Row label="Win Chance" value={`${d.winChance || 0}%`} />
        <Row label="Balance Added" value={`$${Number(d.balanceUsed || 0).toFixed(2)}`} />
        <div>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Cards Used:</span>
          {usedCards.map((c: any, i: number) => (
            <div key={i} className="text-[11px] text-white/60 ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
          ))}
        </div>
        <div>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Target:</span>
          {targets.map((c: any, i: number) => (
            <div key={i} className="text-[11px] text-white/60 ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
          ))}
        </div>
        {prizes.length > 0 && (
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Prize Received:</span>
            {prizes.map((c: any, i: number) => (
              <div key={i} className="text-[11px] ml-3" style={{ color: log.result === 'win' ? '#10b981' : '#f87171' }}>
                {c.name} — ${Number(c.value).toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (type === 'exchange') {
    const offered = d.offeredCards || [];
    const received = d.receivedCards || [];
    return (
      <div className="space-y-1">
        <Row label="Offer Total" value={`$${Number(d.offerTotal || 0).toFixed(2)}`} />
        <Row label="Receive Total" value={`$${Number(d.receiveTotal || 0).toFixed(2)}`} />
        <Row label="Refund" value={`$${Number(d.refund || 0).toFixed(2)}`} />
        <div>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Offered ({offered.length}):</span>
          {offered.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="text-[11px] text-white/60 ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
          ))}
        </div>
        <div>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Received ({received.length}):</span>
          {received.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="text-[11px] text-[#10b981] ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'battle') {
    const players = d.players || [];
    return (
      <div className="space-y-1">
        <Row label="Mode" value={d.mode} />
        <Row label="Packs" value={d.packNames} />
        <Row label="Total Pot" value={`$${Number(d.totalPot || 0).toFixed(2)}`} />
        <div>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Players:</span>
          {players.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 ml-3 text-[11px]">
              <span className={p.isWinner ? 'text-[#ffd700] font-bold' : 'text-white/50'}>
                {p.isWinner ? '👑 ' : ''}{p.username}{p.isAi ? ' (AI)' : ''}
              </span>
              <span className="text-white/30">—</span>
              <span className={p.isWinner ? 'text-[#10b981]' : 'text-white/40'}>
                ${Number(p.totalValue || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'sell') {
    const cards = d.cards || (d.cardName ? [{ name: d.cardName, value: d.value, rarity: d.rarity }] : []);
    return (
      <div className="space-y-1">
        {d.totalCards && <Row label="Total Cards" value={d.totalCards} />}
        <Row label="Total Value" value={`$${Number(d.totalValue || d.value || log.valueIn || 0).toFixed(2)}`} highlight />
        {cards.length > 0 && (
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Cards Sold:</span>
            {cards.slice(0, 10).map((c: any, i: number) => (
              <div key={i} className="text-[11px] text-white/60 ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
            ))}
            {cards.length > 10 && <div className="text-[10px] text-white/30 ml-3">+{cards.length - 10} more...</div>}
          </div>
        )}
      </div>
    );
  }
  if (type === 'deposit') {
    return (
      <div className="space-y-1">
        <Row label="Amount" value={`$${Number(d.amount || log.valueIn || 0).toFixed(2)}`} highlight />
        <Row label="Method" value={d.paymentMethod || 'Stripe'} />
        <Row label="Status" value={d.status} />
        {d.paymentIntentId && <Row label="Payment ID" value={d.paymentIntentId} mono />}
      </div>
    );
  }
  if (type === 'cashout') {
    const cards = d.cards || [];
    return (
      <div className="space-y-1">
        <Row label="Confirmation #" value={d.confirmationNumber} bold />
        <Row label="Total Value" value={`$${Number(d.totalValue || log.valueOut || 0).toFixed(2)}`} highlight />
        <Row label="Total Cards" value={d.totalCards} />
        <Row label="Shipping To" value={d.shippingName} />
        <Row label="Location" value={`${d.shippingCity || ''}${d.shippingState ? ', ' + d.shippingState : ''}`} />
        <Row label="Status" value={d.status || 'pending'} />
        {cards.length > 0 && (
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Cards:</span>
            {cards.slice(0, 8).map((c: any, i: number) => (
              <div key={i} className="text-[11px] text-white/60 ml-3">{c.name} — ${Number(c.value).toFixed(2)}</div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (type === 'admin') {
    return (
      <div className="space-y-1">
        {d.targetUser && <Row label="Target User" value={d.targetUser} bold />}
        {Object.entries(d).filter(([k]) => k !== 'targetUser').map(([k, v]) => (
          <Row key={k} label={k} value={String(v)} />
        ))}
      </div>
    );
  }
  // Fallback: show all details
  return (
    <div className="space-y-1">
      {Object.entries(d).map(([k, v]) => (
        <Row key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
      ))}
    </div>
  );
}

function Row({ label, value, bold, highlight, mono }: {
  label: string; value: any; bold?: boolean; highlight?: boolean; mono?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0 w-24">{label}:</span>
      <span className={`text-[11px] break-all ${bold ? 'font-bold text-white' : ''} ${highlight ? 'text-[#00c8ff]' : 'text-white/70'} ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </span>
    </div>
  );
}

// ── Main LogsTab ────────────────────────────────────────────────────────────
export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '50',
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`${BACKEND_BASE}/admin/logs?${params}`, {
        headers: { 'X-Admin-Secret': 'true', 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LogsResponse = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error('[LogsTab] fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, dateFrom, dateTo, page]);

  // Initial load
  useEffect(() => {
    fetchLogs(1);
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, dateFrom, dateTo]);

  // Page change
  useEffect(() => {
    fetchLogs(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => fetchLogs(page), 8000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const cfg = (type: string) => TYPE_CONFIG[type] || { icon: <Clock size={12} />, color: '#8892a4', bg: 'rgba(136,146,164,0.1)' };
  const resultCfg = (result: string | null) => result ? (RESULT_CONFIG[result] || { icon: null, color: '#8892a4' }) : { icon: null, color: '#8892a4' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-display text-[15px] font-bold uppercase tracking-wider">Site Activity Logs</h2>
          <p className="text-white/30 text-[11px] mt-0.5">
            {total.toLocaleString()} entries tracked across all site actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: autoRefresh ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              border: autoRefresh ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: autoRefresh ? '#10b981' : 'rgba(255,255,255,0.4)',
            }}
          >
            <div className={autoRefresh ? 'w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse' : 'w-1.5 h-1.5 rounded-full bg-white/20'} />
            {autoRefresh ? 'Live' : 'Auto-Refresh Off'}
          </button>
          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ background: 'rgba(155,92,255,0.12)', border: '1px solid rgba(155,92,255,0.3)', color: '#9b5cff' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username, card name, pack name, or action..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-[12px] text-white/80 placeholder:text-white/20 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X size={12} />
              </button>
            )}
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(155,92,255,0.15)', border: '1px solid rgba(155,92,255,0.3)', color: '#9b5cff' }}>
            Search
          </button>
        </form>

        {/* Type filter + Date range */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={12} className="text-white/30" />
          {LOG_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => { setTypeFilter(t.id); setPage(1); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: typeFilter === t.id
                  ? (t.id ? cfg(t.id).bg : 'rgba(255,255,255,0.12)')
                  : 'rgba(255,255,255,0.05)',
                border: typeFilter === t.id
                  ? `1px solid ${t.id ? cfg(t.id).color : 'rgba(255,255,255,0.3)'}`
                  : '1px solid rgba(255,255,255,0.06)',
                color: typeFilter === t.id
                  ? (t.id ? cfg(t.id).color : '#fff')
                  : 'rgba(255,255,255,0.35)',
              }}
            >
              {t.id && cfg(t.id).icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Date Range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded-lg text-[11px] text-white/70 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
          />
          <span className="text-white/20 text-[11px]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded-lg text-[11px] text-white/70 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-white/30 hover:text-white/60 text-[10px]">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log Table */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#9b5cff]/20 border-t-[#9b5cff] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-[13px]">No logs found matching your filters.</div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => {
            const c = cfg(log.type);
            const r = resultCfg(log.result);
            const isExpanded = expandedId === log.id;
            const valueIn = Number(log.valueIn || 0);
            const valueOut = Number(log.valueOut || 0);

            return (
              <div key={log.id}
                className="rounded-xl overflow-hidden transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid rgba(255,255,255,${isExpanded ? '0.1' : '0.04'})` }}
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {/* Type badge */}
                  <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase"
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}40` }}>
                    {c.icon}
                    <span className="hidden sm:block">{log.type.replace('_', ' ')}</span>
                  </div>

                  {/* Username */}
                  <div className="w-28 shrink-0">
                    <span className="text-[11px] font-bold text-white truncate block">{log.username}</span>
                  </div>

                  {/* Action */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] text-white/80 truncate block">{log.action}</span>
                  </div>

                  {/* Value in/out */}
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    {valueIn > 0 && (
                      <span className="text-white/40">In: <span className="text-white/70">${valueIn.toFixed(2)}</span></span>
                    )}
                    {valueOut > 0 && (
                      <span className="text-white/40">Out: <span className="text-[#10b981]">${valueOut.toFixed(2)}</span></span>
                    )}
                  </div>

                  {/* Result */}
                  {log.result && (
                    <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase"
                      style={{ color: r.color }}>
                      {r.icon}
                      <span className="hidden md:block">{log.result.replace('_', ' ')}</span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="shrink-0 text-[10px] text-white/25 text-right hidden lg:block">
                    {fmt(log.createdAt)}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex gap-6">
                      <div className="flex-1">
                        <LogDetail log={log} />
                      </div>
                      <div className="text-right text-[10px] text-white/25 shrink-0">
                        <div>{fmt(log.createdAt)}</div>
                        <div className="mt-1 font-mono text-[9px]">{log.id}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[11px] text-white/30">
            Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()} logs
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <ChevronLeft size={14} className="text-white/60" />
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 7) {
                if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
              }
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: page === p ? 'rgba(155,92,255,0.2)' : 'rgba(255,255,255,0.05)',
                    border: page === p ? '1px solid rgba(155,92,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: page === p ? '#9b5cff' : 'rgba(255,255,255,0.4)',
                  }}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <ChevronRight size={14} className="text-white/60" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
