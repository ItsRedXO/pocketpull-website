import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Activity, Package, DollarSign, Swords, ShoppingCart, Sparkles, ArrowRightLeft, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { BACKEND_BASE } from '../lib/backend';
import { getAdminAuthHeaders } from './adminAuthHeaders';
import { UserRow } from './types';
import { useQuery } from '@tanstack/react-query';
import type { LogEntryRaw, LogsPage, TimelineEntry } from './activityTypes';
import { ActivityDetailPopup } from './ActivityDetailPopup';

interface ActivitySectionProps { user: UserRow; }

const PAGE_SIZE = 50;

// This endpoint sits behind adminLogsGuard, which needs a real bearer token
// (to resolve who's calling) and/or a real admin secret -- the literal
// string 'true' this fetch used to send is explicitly treated as "not a
// credential" by the guard (see isAdminSecretCandidate), so every request
// 401'd and silently came back as "no activity" (see the `!res.ok` fallback
// below) regardless of which filter was clicked. Also: this used to point at
// the pre-migration Blink backend (b2nnhe2n.backend.blink.new), which no
// longer has the current activity_logs data -- BACKEND_BASE is the same
// Railway backend every other admin panel call already uses.
async function adminHeaders(): Promise<Record<string, string>> {
  return { ...await getAdminAuthHeaders() };
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function optNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: any, fallback = ''): string {
  if (v == null) return fallback;
  return typeof v === 'string' ? v : String(v);
}

function arrLen(v: any): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Log type → stat-filter mapping */
const STAT_FILTER_MAP: Record<string, string | null> = {
  Packs:    'pack_open',
  Deposits: 'deposit',
  Sales:    'sell',
  Battles:  'battle',
  Upgrade:  'upgrade',
  Exchange: 'exchange',
  Cashouts: 'cashout',
};

const TYPE_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pack_open: { icon: <Package size={10} />, color: '#9b5cff', label: 'Pack Opened' },
  sell:      { icon: <DollarSign size={10} />, color: '#f59e0b', label: 'Card Sold' },
  battle:    { icon: <Swords size={10} />, color: '#f87171', label: 'Battle' },
  cashout:   { icon: <ShoppingCart size={10} />, color: '#f59e0b', label: 'Cash Out' },
  deposit:   { icon: <CreditCard size={10} />, color: '#10b981', label: 'Deposit' },
  upgrade:   { icon: <Sparkles size={10} />, color: '#ffd700', label: 'Upgrade' },
  exchange:  { icon: <ArrowRightLeft size={10} />, color: '#00c8ff', label: 'Exchange' },
};

function buildAmount(log: LogEntryRaw): { str?: string; color?: string } {
  try {
    const t = log.type;
    const vi = optNum(log.valueIn), vo = optNum(log.valueOut);
    if (t === 'deposit' || t === 'sell') return { str: `+$${vi.toFixed(2)}`, color: '#10b981' };
    if (t === 'pack_open') return { str: `-$${vi.toFixed(2)}`, color: '#9b5cff' };
    if (t === 'upgrade') {
      const isWin = log.result === 'win';
      return { str: isWin ? `+$${vo.toFixed(2)}` : `-$${vi.toFixed(2)}`, color: isWin ? '#10b981' : '#f87171' };
    }
    if (t === 'exchange') return { str: `$${vi.toFixed(2)} â†” $${vo.toFixed(2)}`, color: '#00c8ff' };
    if (t === 'battle') {
      if (vo > 0) return { str: `+$${vo.toFixed(2)}`, color: '#10b981' };
      return { str: `-$${vi.toFixed(2)}`, color: '#f87171' };
    }
    if (t === 'cashout' && vo > 0) return { str: `$${vo.toFixed(2)}`, color: '#f59e0b' };
    return {};
  } catch { return {}; }
}

function buildSubtitle(log: LogEntryRaw): string {
  try {
    const d = log.details || {};
    switch (log.type) {
      case 'pack_open': {
        const won = safeStr(d.cardWon);
        const rarity = safeStr(d.rarity);
        return won ? `Pulled: ${won}${rarity ? ` (${rarity})` : ''}` : 'Pack Opened';
      }
      case 'sell': {
        const n = safeStr(d.cardName);
        const r = safeStr(d.rarity);
        return n ? `${n}${r ? ` (${r})` : ''}` : 'Card Sold';
      }
      case 'battle': {
        const mode = d.mode || 'standard';
        const isShared = d.isShared === true;
        const isDraw = d.isDraw === true;
        const myWinner = d.myResult?.isWinner;

        let status: string;
        if (isShared) {
          status = 'SHARED';
        } else if (isDraw) {
          status = 'DRAW';
        } else if (myWinner) {
          status = 'WON';
        } else {
          status = 'LOST';
        }

        const players: any[] = Array.isArray(d.players) ? d.players : [];
        const modeLabel = mode === 'underdog' ? 'Underdog' : mode === 'shared' ? 'Shared' : 'Standard';
        return `${status} · ${modeLabel} · ${players.length}P · ${safeStr(d.packNames)}`;
      }
      case 'cashout': return `${d.totalCards || 0} cards · ${safeStr(log.result, 'pending')}`;
      case 'deposit': return safeStr(d.paymentMethod, 'Deposit');
      case 'upgrade': return `${log.result === 'win' ? 'WIN' : 'LOSS'} · ${d.winChance != null ? d.winChance + '%' : ''}`;
      case 'exchange': return `${arrLen(d.offeredCards)} → ${arrLen(d.receivedCards)} cards`;
      default: return '';
    }
  } catch { return ''; }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function ActivitySection({ user }: ActivitySectionProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // â”€â”€ Stats: all from backend activity_logs (not Blink DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-user-stats-v2', user.id],
    queryFn: async () => {
      const h = await adminHeaders();
      const base = `${BACKEND_BASE}/admin-logs?userId=${encodeURIComponent(user.id)}&limit=5000`;
      const get = (url: string) => fetch(url, { headers: h }).then(r => r.ok ? r.json() : { rows: [], total: 0 }).catch(() => ({ rows: [], total: 0 }));

      const [packsR, depositsR, sellsR, battlesR, upgradesR, exchangesR, cashoutsR] = await Promise.all([
        get(`${base}&type=pack_open&limit=1`),
        get(`${base}&type=deposit`),
        get(`${base}&type=sell`),
        get(`${base}&type=battle`),
        get(`${base}&type=upgrade&limit=1`),
        get(`${base}&type=exchange&limit=1`),
        get(`${base}&type=cashout`),
      ]);

      const depositsTotal = (depositsR.rows || []).reduce((s: number, r: any) => s + optNum(r.valueIn), 0);
      const sellsTotal = (sellsR.rows || []).reduce((s: number, r: any) => s + optNum(r.valueIn), 0);
      const battlesRows: any[] = battlesR.rows || [];
      const battlesWins = battlesRows.filter((r: any) => r.result === 'win' || optNum(r.valueOut) > 0).length;
      const cashoutsRows: any[] = cashoutsR.rows || [];
      const cashoutPending = cashoutsRows.filter((r: any) => r.result === 'pending').length;

      return {
        packsCount: packsR.total || 0,
        depositsCount: depositsR.total || 0,
        depositsTotal,
        sellsCount: sellsR.total || 0,
        sellsTotal,
        battlesTotal: battlesR.total || 0,
        battlesWins,
        upgradeCount: upgradesR.total || 0,
        exchangeCount: exchangesR.total || 0,
        cashoutCount: cashoutsR.total || 0,
        cashoutPending,
        battleRows: battlesRows,
      };
    },
    staleTime: 0,
  });

  const packsTotal    = userStats?.packsCount ?? 0;
  const depositData   = { count: userStats?.depositsCount ?? 0, totalValue: userStats?.depositsTotal ?? 0, bonusValue: 0, referralValue: 0 };
  const sellsData     = { count: userStats?.sellsCount ?? 0, totalValue: userStats?.sellsTotal ?? 0 };
  const battlesData   = { total: userStats?.battlesTotal ?? 0, wins: userStats?.battlesWins ?? 0 };
  const upgradeCount  = userStats?.upgradeCount ?? 0;
  const exchangeCount = userStats?.exchangeCount ?? 0;
  const cashoutCount  = userStats?.cashoutCount ?? 0;
  const pendingCashouts = userStats?.cashoutPending ?? 0;
  const packsLoading = statsLoading;
  const depositsLoading = statsLoading;
  const sellsLoading = statsLoading;
  const battlesLoading = statsLoading;

  // Battle timeline entries: built from the battle rows already fetched above
  const battleHistory = React.useMemo(() => (userStats?.battleRows || []).map((r: any) => {
    const d = (() => { try { return typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}); } catch { return {}; } })();
    return {
      id: r.id, battleId: d.battleId || r.id, mode: d.mode || 'standard',
      packNames: d.packNames || '', totalCost: optNum(r.valueIn),
      playerCount: Array.isArray(d.players) ? d.players.length : 1,
      endedAt: r.createdAt,
      players: Array.isArray(d.players) ? d.players : [],
      myResult: d.myResult || { isWinner: r.result === 'win' || optNum(r.valueOut) > 0, totalValue: optNum(r.valueOut) },
      winnerUserId: null, winnerUsername: d.winner?.username || null,
      totalPot: optNum(r.valueIn),
    };
  }), [userStats]);

  // â”€â”€ Paginated activity logs (backend endpoint, supports type filter) â”€â”€â”€â”€â”€â”€â”€â”€

  const { data: logsPage, isLoading } = useQuery<LogsPage>({
    queryKey: ['admin-activity-logs-v2', user.id, page, typeFilter],
    queryFn: async () => {
      // Battle filter uses local battleHistory — skip backend call
      if (typeFilter === 'battle') return { rows: [], total: 0 };

      let url = `${BACKEND_BASE}/admin-logs?userId=${encodeURIComponent(user.id)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      if (typeFilter) url += `&type=${encodeURIComponent(typeFilter)}`;

      const res = await fetch(url, { headers: await adminHeaders() });
      if (!res.ok) return { rows: [], total: 0 };
      const json = await res.json() as { rows: any[]; total: number };
      return {
        rows: (json.rows || []).map((r: any) => ({
          id: safeStr(r.id),
          type: safeStr(r.type),
          action: safeStr(r.action, r.type),
          details: (() => {
            const raw = r.details || r.metadata || {};
            if (typeof raw !== 'string') return raw;
            try { return JSON.parse(raw); } catch { return {}; }
          })(),
          valueIn: optNum(r.valueIn || r.value_in),
          valueOut: optNum(r.valueOut || r.value_out),
          result: safeStr(r.result),
          createdAt: safeStr(r.createdAt || r.created_at),
          userId: safeStr(r.userId || r.user_id),
          username: safeStr(r.username),
        })),
        total: optNum(json.total, 0),
      };
    },
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const activityLogs = logsPage?.rows || [];
  const totalActivityCount = logsPage?.total || 0;

  // â”€â”€ When Battles filter is active, build entries from battleHistory â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The activityLogs table only has winner-centric entries.  battleHistory
  // queries battlePlayers directly for all participations — wins, losses,
  // draws, and shared-mode are all present.
  const battleTimelineEntries: LogEntryRaw[] = React.useMemo(() => {
    if (typeFilter !== 'battle') return [];
    return battleHistory.map((bh: any) => {
      const mode = bh.mode;
      const isShared = mode === 'shared';
      const myIsWinner = bh.myResult?.isWinner;

      // Determine result and winner detail
      let resultLabel: string;
      let winnerDetail: any;
      if (isShared) {
        resultLabel = 'shared';
        winnerDetail = null;
      } else {
        const anyWinner = bh.players?.some((p: any) => p.isWinner);
        if (!anyWinner) {
          resultLabel = 'draw';
          winnerDetail = null;
        } else {
          resultLabel = 'completed';
          const wp = bh.players?.find((p: any) => p.isWinner);
          winnerDetail = wp ? { username: wp.username, totalValue: wp.totalValue } : null;
        }
      }

      return {
        id: bh.id || bh.battleId,
        type: 'battle' as const,
        action: isShared
          ? 'Pack Battle (Shared)'
          : resultLabel === 'draw'
            ? 'Pack Battle (Draw)'
            : myIsWinner
              ? `Pack Battle ${mode === 'underdog' ? '(Underdog)' : '(Standard)'}`
              : `Pack Battle ${mode === 'underdog' ? '(Underdog)' : '(Standard)'}`,
        details: {
          battleId: bh.battleId,
          mode,
          isDraw: resultLabel === 'draw',
          isShared,
          packNames: bh.packNames,
          packCount: bh.players?.[0]?.cards?.length || bh.packNames?.split(',').length || 1,
          players: bh.players || [],
          winner: winnerDetail,
          totalPot: bh.totalPot || 0,
          myResult: bh.myResult,
        },
        valueIn: bh.totalCost * bh.playerCount || 0,
        valueOut: myIsWinner ? bh.myResult?.totalValue || 0 : 0,
        result: resultLabel,
        createdAt: bh.endedAt,
        userId: user.id,
        username: user.username,
      } as LogEntryRaw;
    });
  }, [battleHistory, typeFilter, user]);

  // Use battle history when Battles filter is active; activity logs otherwise
  const effectiveLogs = typeFilter === 'battle' ? battleTimelineEntries : activityLogs;
  const effectiveTotal = typeFilter === 'battle' ? battleTimelineEntries.length : totalActivityCount;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / PAGE_SIZE));

  // â”€â”€ Build timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const timeline: TimelineEntry[] = React.useMemo(() => {
    try {
      return effectiveLogs.map((log: LogEntryRaw) => {
        const t = TYPE_MAP[log.type] || { icon: <Activity size={10} />, color: '#8892a4', label: log.type || 'Activity' };
        const amt = buildAmount(log);
        return {
          type: log.type as TimelineEntry['type'],
          title: log.action || t.label,
          subtitle: buildSubtitle(log),
          date: log.createdAt,
          amount: amt.str,
          color: t.color,
          icon: t.icon,
          amountColor: amt.color,
          logData: log,
        };
      });
    } catch {
      return [];
    }
  }, [effectiveLogs]);

  // â”€â”€ Stat cards (clickable — single-select type filter toggle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const statCards = [
    { id: 'Packs',    label: 'Packs',    value: packsLoading ? '...' : String(packsTotal), color: '#9b5cff', icon: <Package size={10} /> },
    { id: 'Deposits', label: 'Deposits', value: depositsLoading ? '...' : '$' + depositData.totalValue.toFixed(0), color: '#10b981', icon: <CreditCard size={10} />, sub: (depositData.bonusValue > 0 || depositData.referralValue > 0) ? '+$' + depositData.bonusValue.toFixed(0) + ' match / +$' + depositData.referralValue.toFixed(0) + ' ref' : undefined },
    { id: 'Sales',    label: 'Sales',    value: sellsLoading ? '...' : '$' + sellsData.totalValue.toFixed(0), color: '#f59e0b', icon: <DollarSign size={10} />, sub: sellsData.count > 0 ? sellsData.count + ' sold' : undefined },
    { id: 'Battles',  label: 'Battles',  value: battlesLoading ? '...' : `${battlesData.wins}/${battlesData.total} won`, color: '#f87171', icon: <Swords size={10} /> },
    { id: 'Upgrade',  label: 'Upgrade',  value: String(upgradeCount), color: '#ffd700', icon: <Sparkles size={10} /> },
    { id: 'Exchange', label: 'Exchange', value: String(exchangeCount), color: '#00c8ff', icon: <ArrowRightLeft size={10} /> },
    { id: 'Cashouts', label: 'Cashouts', value: String(cashoutCount), color: '#9b5cff', icon: <ShoppingCart size={10} />, sub: pendingCashouts > 0 ? `${pendingCashouts} pending` : undefined },
  ];

  const handleStatClick = (statId: string) => {
    const filterType = STAT_FILTER_MAP[statId] || null;
    setPage(0);
    setTypeFilter(prev => prev === filterType ? null : filterType);
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-sans mb-3 flex items-center gap-2">
        <Activity size={12} className="text-[#00c8ff]" />
        Activity &amp; History
        {typeFilter && (
          <span
            className="ml-1 px-1.5 py-0.5 rounded text-[8px] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: '#ffffff10', border: '1px solid #ffffff15', color: '#ffd700' }}
            onClick={() => { setTypeFilter(null); setPage(0); }}
          >
            {typeFilter.replace('_', ' ')} âœ•
          </span>
        )}
      </h4>

      {/* Summary grid — clickable stat cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {statCards.map(s => {
          const filterType = STAT_FILTER_MAP[s.id];
          const isActive = typeFilter === filterType;
          return (
            <button
              key={s.id}
              onClick={() => handleStatClick(s.id)}
              className="rounded-lg p-2.5 text-center transition-all cursor-pointer border"
              style={{
                background: isActive ? `${s.color}18` : 'rgba(255,255,255,0.04)',
                borderColor: isActive ? `${s.color}60` : 'rgba(255,255,255,0.06)',
                boxShadow: isActive ? `0 0 10px -4px ${s.color}40` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: s.color }}>{s.icon}</div>
              <p className="text-[12px] font-sans font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] text-white/30 uppercase tracking-wider">{s.label}</p>
              {'sub' in s && s.sub && <p className="text-[8px] text-amber-400/70">{s.sub}</p>}
            </button>
          );
        })}
      </div>

      {/* Active filter chip */}
      {typeFilter && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-[9px] text-white/25 uppercase tracking-wider">Showing:</span>
          <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase"
            style={{ background: `${(TYPE_MAP[typeFilter]?.color || '#888')}18`, color: TYPE_MAP[typeFilter]?.color || '#888' }}>
            {TYPE_MAP[typeFilter]?.label || typeFilter}
          </span>
          <button onClick={() => { setTypeFilter(null); setPage(0); }} className="text-[9px] text-white/25 hover:text-white/50 ml-1">clear</button>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
        </div>
      ) : timeline.length === 0 ? (
        <p className="text-[11px] text-white/20 text-center py-4">
          {typeFilter ? 'No matching activity for this filter.' : 'No activity yet.'}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {timeline.map((entry, i) => (
              <div
                key={entry.logData?.id || i}
                onClick={() => setSelectedEntry(entry)}
                className="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: entry.color + '18', color: entry.color }}>
                  {entry.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/80 truncate">{entry.title}</p>
                  {entry.subtitle && <p className="text-[8px] text-white/30 truncate">{entry.subtitle}</p>}
                </div>
                <div className="text-right shrink-0">
                  {entry.amount && <p className="text-[9px] font-bold font-sans" style={{ color: entry.amountColor || entry.color }}>{entry.amount}</p>}
                  <p className="text-[7px] text-white/20">{entry.date ? new Date(entry.date).toLocaleDateString() : ''}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <p className="text-[9px] text-white/20">{effectiveTotal} total · Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {selectedEntry && <ActivityDetailPopup entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
      </AnimatePresence>
    </div>
  );
}
