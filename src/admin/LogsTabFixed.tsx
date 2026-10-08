import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, Filter, X, ChevronLeft, ChevronRight, Shield, CheckCircle, XCircle, AlertCircle, Package, DollarSign, Swords, ShoppingCart, Sparkles, ArrowRightLeft, CreditCard, Bot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BACKEND_BASE } from '../lib/backend';
import { getAdminAuthHeaders } from './adminAuthHeaders';
import { blink } from '../lib/blink';

// ── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string; type: string; userId: string | null; username: string;
  action: string; details: Record<string, any>; valueIn: number;
  valueOut: number; result: string | null; metadata: Record<string, any>;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', 'ultra rare': '#9b5cff', secret: '#ffd700',
  god: '#ff00ff', promo: '#f59e0b',
};

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pack_open: { label: 'Pack Opening', color: '#9b5cff', icon: <Package size={11} /> },
  sell:      { label: 'Card Sale',    color: '#f59e0b', icon: <DollarSign size={11} /> },
  battle:    { label: 'Battle',       color: '#f87171', icon: <Swords size={11} /> },
  cashout:   { label: 'Cash Out',     color: '#fcd34d', icon: <ShoppingCart size={11} /> },
  deposit:   { label: 'Deposit',      color: '#10b981', icon: <CreditCard size={11} /> },
  upgrade:   { label: 'Upgrader',     color: '#ffd700', icon: <Sparkles size={11} /> },
  exchange:  { label: 'Exchange',     color: '#00c8ff', icon: <ArrowRightLeft size={11} /> },
  admin:     { label: 'Admin Action', color: '#f87171', icon: <Shield size={11} /> },
};

function resultIcon(result: string | null) {
  if (result === 'win' || result === 'success' || result === 'sold' || result === 'sold_all' || result === 'completed' || result === 'pulled')
    return <CheckCircle size={10} />;
  if (result === 'loss') return <XCircle size={10} />;
  if (result === 'pending') return <AlertCircle size={10} />;
  if (result === 'admin_action') return <Shield size={10} />;
  return null;
}

function fmt(v: number) { return `$${v.toFixed(2)}`; }
function fmtDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function authHeaders() {
  const h = await getAdminAuthHeaders();
  return { 'Content-Type': 'application/json', ...h };
}

// ── Row summary line ──────────────────────────────────────────────────────────

function rowSummary(log: LogEntry, cardImageMap: Record<string, string>): { line1: string; line2?: string; imgUrl?: string; packImg?: string } {
  const d = log.details || {};
  switch (log.type) {
    case 'pack_open': {
      const key = `${String(d.cardWon || '').toLowerCase()}::${String(d.rarity || '').toLowerCase()}`;
      return {
        line1: d.cardWon || '—',
        line2: `${String(d.rarity || '').toUpperCase()} · ${d.packName || '—'} · paid ${fmt(Number(d.packCost || log.valueIn || 0))} · pulled ${fmt(Number(d.cardValue || log.valueOut || 0))}`,
        imgUrl: cardImageMap[key] || undefined,
      };
    }
    case 'sell': {
      const cards: any[] = Array.isArray(d.cards) ? d.cards : d.cardName ? [{ name: d.cardName }] : [];
      return {
        line1: cards.length > 1 ? `${cards.length} cards sold` : (cards[0]?.name || d.cardName || '—'),
        line2: `Total: ${fmt(Number(d.totalValue || log.valueIn || 0))}`,
      };
    }
    case 'battle': {
      const me = d.myResult;
      const opp = Array.isArray(d.players) ? d.players.find((p: any) => p.username !== log.username) : null;
      return {
        line1: opp ? `vs ${opp.username}` : (d.packNames || '—'),
        line2: `Pot: ${fmt(Number(d.totalPot || log.valueIn || 0))} · ${me?.isWinner ? 'WON' : d.isShared ? 'SHARED' : 'LOST'}`,
      };
    }
    case 'deposit':
      return { line1: `+${fmt(Number(d.amount || log.valueIn || 0))}`, line2: d.paymentMethod || '—' };
    case 'cashout':
      return { line1: `${fmt(Number(d.totalValue || log.valueOut || 0))} · ${d.totalCards || 0} cards`, line2: d.status || log.result || '—' };
    case 'upgrade': {
      const won = log.result === 'win';
      return { line1: won ? `WIN → ${fmt(Number(log.valueOut || 0))}` : `LOSS · ${fmt(Number(log.valueIn || 0))} in`, line2: d.winChance != null ? `${d.winChance}% chance` : undefined };
    }
    case 'exchange':
      return { line1: `Traded ${(d.offeredCards || []).length} → received ${(d.receivedCards || []).length}`, line2: undefined };
    case 'admin': {
      const target = d.targetUser ? `→ ${d.targetUser}` : '';
      const delta = d.delta != null ? ` (${d.delta > 0 ? '+' : ''}${fmt(d.delta)})` : d.newBalance != null ? ` → ${fmt(d.newBalance)}` : '';
      return { line1: `${log.action}${delta}`, line2: target || undefined };
    }
    default:
      return { line1: log.action || '—' };
  }
}

// ── Card image map ────────────────────────────────────────────────────────────

function useCardImageMap() {
  return useQuery<Record<string, string>>({
    queryKey: ['admin-packcard-images'],
    queryFn: async () => {
      try {
        const rows = await blink.db.packCards.list({ limit: 5000 }) as any[];
        const map: Record<string, string> = {};
        for (const r of rows) {
          const key = `${String(r.cardName || '').toLowerCase()}::${String(r.rarity || '').toLowerCase()}`;
          if (!map[key] && r.cardImageUrl) map[key] = r.cardImageUrl;
        }
        return map;
      } catch { return {}; }
    },
    staleTime: 5 * 60_000,
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function LogsTabFixed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<LogEntry | null>(null);

  const { data: cardImageMap = {} } = useCardImageMap();

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const headers = await authHeaders();
      const response = await fetch(`${BACKEND_BASE}/admin/logs?${params}`, { headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setTotal(Number(payload.total) || 0);
      setTotalPages(Math.max(1, Number(payload.totalPages) || 1));
    } catch (e: any) {
      setError(e?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page, search, type]);

  useEffect(() => { void load(page); }, [load, page]);

  const applyFilters = () => { setPage(1); void load(1); };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Audit trail</p>
          <h1 className="font-sans text-2xl uppercase text-white">Activity Logs</h1>
          <p className="text-[11px] text-white/30 mt-0.5">All user & admin actions — pack openings, battles, sales, deposits, admin changes</p>
        </div>
        <button onClick={() => void load(page)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-2 md:grid-cols-[1fr_180px_150px_150px_auto]">
        <label className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="Search user, card, action…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-[#9b5cff]/50" />
        </label>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none">
          <option value="">All types</option>
          {Object.entries(TYPE_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/60 outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/60 outline-none" />
        <button onClick={applyFilters}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#9b5cff]/25 bg-[#9b5cff]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9b5cff] hover:bg-[#9b5cff]/15">
          <Filter size={12} /> Apply
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">{error}</div>}

      {/* Log list */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {loading && logs.length === 0
          ? <div className="p-12 text-center text-sm text-white/30">Loading activity…</div>
          : logs.length === 0
          ? <div className="p-12 text-center text-sm text-white/30">No entries match these filters.</div>
          : logs.map(log => {
            const meta = TYPE_META[log.type] || { label: log.type || 'Unknown', color: '#9ca3af', icon: null };
            const { line1, line2, imgUrl } = rowSummary(log, cardImageMap);
            const rarity = String(log.details?.rarity || '').toLowerCase();
            const rarityColor = RARITY_COLOR[rarity] || '#8892a4';
            const value = Number(log.valueOut || log.valueIn || 0);
            const isAdmin = log.type === 'admin';

            return (
              <button key={log.id} onClick={() => setSelected(log)}
                className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04]">

                {/* Thumbnail / icon */}
                <div className="shrink-0 w-11 h-14 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ background: imgUrl ? 'transparent' : `${meta.color}15`, border: imgUrl ? 'none' : `1px solid ${meta.color}25` }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={line1} className="w-full h-full object-cover" />
                    : <span style={{ color: meta.color }}>{meta.icon}</span>}
                </div>

                {/* Type badge + action */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
                      style={{ color: meta.color, background: `${meta.color}18` }}>{meta.label}</span>
                    {log.type === 'pack_open' && rarity && (
                      <span className="text-[8px] font-bold uppercase tracking-wider"
                        style={{ color: rarityColor }}>{rarity}</span>
                    )}
                    {isAdmin && <span className="text-[8px] text-white/25 flex items-center gap-0.5"><Bot size={8} /> {log.username}</span>}
                  </div>
                  <p className="text-[12px] text-white font-bold truncate">{line1}</p>
                  {line2 && <p className="text-[10px] text-white/35 truncate mt-0.5">{line2}</p>}
                </div>

                {/* Username */}
                <div className="hidden md:block shrink-0 w-32 text-[11px] text-white/50 truncate text-right">{log.username || '—'}</div>

                {/* Value */}
                <div className="shrink-0 w-24 text-right">
                  {log.type === 'pack_open' ? (
                    <div>
                      <p className="text-[10px] text-red-400">-{fmt(Number(log.details?.packCost || log.valueIn || 0))}</p>
                      <p className="text-[11px] font-bold text-green-400">+{fmt(Number(log.details?.cardValue || log.valueOut || 0))}</p>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold" style={{ color: value ? '#10b981' : '#ffffff40' }}>
                      {value ? fmt(value) : '—'}
                    </span>
                  )}
                </div>

                {/* Date */}
                <div className="shrink-0 w-32 text-right text-[10px] text-white/25 hidden lg:block">
                  {fmtDate(log.createdAt)}
                </div>

                {/* Result */}
                <div className="shrink-0 text-white/30">{resultIcon(log.result)}</div>
              </button>
            );
          })
        }
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/30">{total.toLocaleString()} total · Page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 disabled:opacity-30">
            <ChevronLeft size={13} />
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 disabled:opacity-30">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Detail popup */}
      {selected && <LogDetailModal log={selected} cardImageMap={cardImageMap} onClose={() => setSelected(null)} />}
    </section>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function LogDetailModal({ log, cardImageMap, onClose }: { log: LogEntry; cardImageMap: Record<string, string>; onClose: () => void }) {
  const meta = TYPE_META[log.type] || { label: log.type, color: '#9ca3af', icon: null };
  const d = log.details || {};
  const rarity = String(d.rarity || '').toLowerCase();
  const rarityColor = RARITY_COLOR[rarity] || '#8892a4';
  const cardKey = `${String(d.cardWon || '').toLowerCase()}::${rarity}`;
  const cardImg = cardImageMap[cardKey];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a] shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}20`, color: meta.color }}>
              {meta.icon}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: meta.color }}>{meta.label}</p>
              <h2 className="text-sm font-bold text-white">{log.action}</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-68px)] overflow-y-auto">
          {/* Card image for pack openings */}
          {log.type === 'pack_open' && (
            <div className="relative flex items-center justify-center p-6 bg-black/30">
              {cardImg ? (
                <img src={cardImg} alt={d.cardWon || 'Card'} className="max-h-64 w-auto object-contain rounded-xl drop-shadow-2xl" />
              ) : (
                <div className="w-32 h-44 rounded-xl bg-white/5 flex items-center justify-center text-4xl">🃏</div>
              )}
              {rarity && (
                <div className="absolute inset-0 pointer-events-none opacity-20 rounded-none"
                  style={{ background: `radial-gradient(ellipse at center, ${rarityColor} 0%, transparent 70%)` }} />
              )}
              {rarity && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ color: rarityColor, background: `${rarityColor}20`, border: `1px solid ${rarityColor}40` }}>
                  {rarity}
                </span>
              )}
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* Meta grid */}
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoCell label="User" value={log.username || log.userId || 'System'} />
              <InfoCell label="Date" value={fmtDate(log.createdAt)} />
              {log.result && <InfoCell label="Result" value={log.result} />}
              {log.valueIn > 0 && <InfoCell label="Value In" value={fmt(log.valueIn)} color="text-red-400" />}
              {log.valueOut > 0 && <InfoCell label="Value Out" value={fmt(log.valueOut)} color="text-green-400" />}
            </div>

            {/* Type-specific detail body */}
            <LogDetailBody log={log} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, color = 'text-white/75' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="mb-1 text-[9px] uppercase tracking-wider text-white/30">{label}</p>
      <p className={`break-words text-xs font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DR({ label, value, color = 'text-white/65' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/35 shrink-0">{label}</span>
      <span className={`${color} font-bold text-right ml-3 break-all max-w-[260px]`}>{value}</span>
    </div>
  );
}

function LogDetailBody({ log }: { log: LogEntry }) {
  const d: any = log.details || {};
  const { type, valueIn, valueOut, result } = log;

  if (type === 'pack_open') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#9b5cff] mb-3 font-bold">Pack Opening</p>
        <DR label="Pack" value={d.packName || '—'} />
        <DR label="Pack Cost" value={`-${fmt(Number(d.packCost || valueIn || 0))}`} color="text-red-400" />
        <DR label="Card Won" value={d.cardWon || '—'} color="text-white" />
        {d.rarity && <DR label="Rarity" value={String(d.rarity).toUpperCase()} color="text-[#ffd700]" />}
        <DR label="Card Value" value={`+${fmt(Number(d.cardValue || valueOut || 0))}`} color="text-green-400" />
        {d.rollValue != null && <DR label="Roll" value={Number(d.rollValue).toFixed(4)} />}
        {d.inventoryId && <DR label="Inventory ID" value={d.inventoryId} />}
      </div>
    );
  }

  if (type === 'battle') {
    const isWin = result === 'win' || d.myResult?.isWinner;
    const isShared = d.isShared;
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#f87171] mb-3 font-bold">Battle</p>
        <DR label="Mode" value={d.mode || 'standard'} />
        <DR label="Packs Used" value={d.packNames || '—'} />
        <DR label="Total Pot" value={fmt(Number(d.totalPot || valueIn || 0))} color="text-[#ffd700]" />
        {d.myResult && <DR label="My Value" value={fmt(Number(d.myResult.totalValue || 0))} color={isShared || isWin ? 'text-green-400' : 'text-red-400'} />}
        {Array.isArray(d.players) && d.players.map((p: any, i: number) => (
          <DR key={i} label={p.username || `Player ${i + 1}`} value={`${fmt(Number(p.totalValue || 0))}${p.isWinner ? ' 👑' : ''}`} color={p.isWinner ? 'text-[#ffd700]' : 'text-white/50'} />
        ))}
        {d.winner?.username && <DR label="Winner" value={d.winner.username} color="text-[#ffd700]" />}
      </div>
    );
  }

  if (type === 'sell') {
    const cards: any[] = Array.isArray(d.cards) ? d.cards : d.cardName ? [{ name: d.cardName, rarity: d.rarity, value: d.value }] : [];
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#f59e0b] mb-3 font-bold">Cards Sold</p>
        {cards.map((c: any, i: number) => (
          <DR key={i} label={c.name || `Card ${i + 1}`} value={`+${fmt(Number(c.value || 0))}`} color="text-green-400" />
        ))}
        <DR label="Total" value={`+${fmt(Number(d.totalValue || valueIn || 0))}`} color="text-green-400" />
      </div>
    );
  }

  if (type === 'upgrade') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#ffd700] mb-3 font-bold">Upgrader</p>
        {d.winChance != null && <DR label="Success Chance" value={`${d.winChance}%`} color="text-[#00c8ff]" />}
        <DR label="Value In" value={`-${fmt(Number(valueIn || 0))}`} color="text-red-400" />
        <DR label="Value Out" value={`+${fmt(Number(valueOut || 0))}`} color={result === 'win' ? 'text-green-400' : 'text-red-400'} />
        {Array.isArray(d.cardsUsed) && d.cardsUsed.map((c: any, i: number) => <DR key={i} label={`Card in ${i + 1}`} value={c.name || '—'} />)}
        {Array.isArray(d.prizeReceived) && d.prizeReceived.map((c: any, i: number) => <DR key={i} label={`Prize ${i + 1}`} value={c.name || '—'} color="text-green-400" />)}
      </div>
    );
  }

  if (type === 'deposit') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#10b981] mb-3 font-bold">Deposit</p>
        <DR label="Amount" value={`+${fmt(Number(d.amount || valueIn || 0))}`} color="text-green-400" />
        <DR label="Method" value={d.paymentMethod || '—'} />
        <DR label="Status" value={d.status || result || '—'} color="text-green-400" />
        {d.paymentIntentId && <DR label="Stripe ID" value={d.paymentIntentId} />}
        {d.chargeId && <DR label="Coinbase ID" value={d.chargeId} />}
      </div>
    );
  }

  if (type === 'cashout') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#f59e0b] mb-3 font-bold">Cash Out</p>
        <DR label="Status" value={d.status || result || '—'} color="text-[#f59e0b]" />
        <DR label="Cards" value={String(d.totalCards || 0)} />
        <DR label="Total Value" value={fmt(Number(d.totalValue || valueOut || 0))} color="text-green-400" />
        {d.confirmationNumber && <DR label="Confirmation #" value={d.confirmationNumber} color="text-[#ffd700]" />}
        {d.shippingName && <DR label="Ship To" value={d.shippingName} />}
        {Array.isArray(d.cards) && d.cards.map((c: any, i: number) => (
          <DR key={i} label={c.name || `Card ${i + 1}`} value={fmt(Number(c.value || 0))} />
        ))}
      </div>
    );
  }

  if (type === 'exchange') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#00c8ff] mb-3 font-bold">Exchange</p>
        {Array.isArray(d.offeredCards) && d.offeredCards.map((c: any, i: number) => <DR key={`o${i}`} label={`Traded in: ${c.name || '?'}`} value={`-${fmt(Number(c.value || 0))}`} color="text-red-400" />)}
        {Array.isArray(d.receivedCards) && d.receivedCards.map((c: any, i: number) => <DR key={`r${i}`} label={`Received: ${c.name || '?'}`} value={`+${fmt(Number(c.value || 0))}`} color="text-green-400" />)}
        {d.refund > 0 && <DR label="Refund" value={`+${fmt(Number(d.refund))}`} color="text-[#00c8ff]" />}
      </div>
    );
  }

  if (type === 'admin') {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
        <p className="text-[9px] uppercase tracking-widest text-[#f87171] mb-3 font-bold">Admin Action</p>
        {d.targetUser && <DR label="Target User" value={d.targetUser} color="text-white" />}
        {d.delta != null && <DR label="Balance Change" value={`${d.delta > 0 ? '+' : ''}${fmt(Number(d.delta))}`} color={d.delta >= 0 ? 'text-green-400' : 'text-red-400'} />}
        {d.newBalance != null && <DR label="New Balance" value={fmt(Number(d.newBalance))} />}
        {d.previousBalance != null && <DR label="Previous Balance" value={fmt(Number(d.previousBalance))} />}
        {d.newGems != null && <DR label="New Gems" value={String(d.newGems)} color="text-[#9b5cff]" />}
        {d.previousGems != null && <DR label="Previous Gems" value={String(d.previousGems)} />}
        {d.settingKey && <DR label="Setting Changed" value={d.settingKey} />}
        {d.oldValue != null && <DR label="Old Value" value={String(d.oldValue)} />}
        {d.newValue != null && <DR label="New Value" value={String(d.newValue)} color="text-[#00c8ff]" />}
        {Object.entries(d).filter(([k]) => !['targetUser','delta','newBalance','previousBalance','newGems','previousGems','settingKey','oldValue','newValue'].includes(k))
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .map(([k, v]) => <DR key={k} label={k} value={String(v)} />)}
      </div>
    );
  }

  const entries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-0">
      {entries.map(([k, v]) => <DR key={k} label={k} value={String(v)} />)}
    </div>
  );
}
