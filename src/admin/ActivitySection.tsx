import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Activity, Package, DollarSign, Swords, ShoppingCart, Sparkles, ArrowRightLeft, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { blink } from '../lib/blink';
import { UserRow } from './types';
import { useQuery } from '@tanstack/react-query';
import type { LogEntryRaw, LogsPage, TimelineEntry } from './activityTypes';
import { ActivityDetailPopup } from './ActivityDetailPopup';

interface ActivitySectionProps { user: UserRow; }

const BACKEND = 'https://b2nnhe2n.backend.blink.new';
const PAGE_SIZE = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (t === 'exchange') return { str: `$${vi.toFixed(2)} ↔ $${vo.toFixed(2)}`, color: '#00c8ff' };
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

// ═══════════════════════════════════════════════════════════════════════════

export function ActivitySection({ user }: ActivitySectionProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // ── Stats queries (using count() for accuracy — no limit caps) ──────────────

  const { data: packsTotal = 0, isLoading: packsLoading } = useQuery<number>({
    queryKey: ['admin-packs-count', user.id],
    queryFn: async () => {
      const n = await blink.db.packsOpened.count({ where: { userId: user.id } });
      return typeof n === 'number' ? n : 0;
    }, staleTime: 0,
  });

  // Sell total: sum amounts from transactions (type = 'sell'). Uses a high
  // fetch limit because there's no server-side SUM — client-side reduce is fine
  // for admin panel volumes.
  const { data: sellsData = { count: 0, totalValue: 0 }, isLoading: sellsLoading } = useQuery<{ count: number; totalValue: number }>({
    queryKey: ['admin-sells-v2', user.id],
    queryFn: async () => {
      try {
        const rows = await blink.db.transactions.list({ where: { userId: user.id, type: 'sell' }, limit: 10000 });
        const arr = Array.isArray(rows) ? rows : [];
        return { count: arr.length, totalValue: arr.reduce((s: number, d: any) => s + optNum(d.amount), 0) };
      } catch { return { count: 0, totalValue: 0 }; }
    }, staleTime: 0,
  });

  // ── Battles: query ALL participations from battlePlayers, not just hosted ───
  // The previous code only counted battles the user HOSTED via hostUserId.
  // We now query battlePlayers to find every battle they participated in,
  // then fetch the corresponding battle + all player rows for full detail.
  // This captures wins, losses, draws, and shared-mode participations.
  const { data: battleHistory = [], isLoading: battlesLoading } = useQuery<any[]>({
    queryKey: ['admin-battle-participations', user.id],
    queryFn: async () => {
      try {
        const bpRows = await blink.db.battlePlayers.list({
          where: { userId: user.id },
          limit: 5000,
        }) as any[];
        if (!bpRows?.length) return [];

        const results: any[] = [];
        for (const bp of bpRows) {
          try {
            const battle = await blink.db.battles.get(bp.battleId) as any;
            if (!battle || battle.status !== 'finished') continue;

            const allPlayers = await blink.db.battlePlayers.list({
              where: { battleId: bp.battleId },
              limit: 20,
            }) as any[];

            const packs = (() => { try { return JSON.parse(battle.packsJson || '[]'); } catch { return []; } })();
            const packNames = packs.map((p: any) => p.name).join(', ');
            const playerCount = allPlayers.length;

            results.push({
              id: `bh-${bp.battleId}`,
              battleId: bp.battleId,
              mode: battle.mode || 'standard',
              packNames,
              totalCost: Number(battle.totalCost || 0),
              playerCount,
              endedAt: battle.endedAt || battle.createdAt,
              players: allPlayers.map((p: any) => ({
                username: p.username,
                isAi: Number(p.isAi || 0) > 0,
                totalValue: Number(p.totalValue || 0),
                isWinner: Number(p.isWinner || 0) > 0,
                cards: (() => { try { return JSON.parse(p.cardsJson || '[]'); } catch { return []; } })().slice(0, 5).map((c: any) => ({
                  name: c.name, value: Number(c.value || 0), rarity: c.rarity,
                })),
              })),
              myResult: {
                isWinner: Number(bp.isWinner || 0) > 0,
                totalValue: Number(bp.totalValue || 0),
              },
              winnerUserId: battle.winnerUserId || null,
              winnerUsername: battle.winnerUsername || null,
              totalPot: Number(battle.totalCost || 0) * playerCount,
            });
          } catch { /* skip broken rows */ }
        }

        return results.sort((a: any, b: any) =>
          new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
        );
      } catch { return []; }
    },
    staleTime: 0,
  });

  // Derived battle stats from battleHistory (all participations, not just hosted)
  const battlesData = React.useMemo(() => {
    const total = battleHistory.length;
    let wins = 0;
    for (const bh of battleHistory) {
      if (bh.myResult?.isWinner && bh.mode !== 'shared') wins++;
    }
    return { total, wins };
  }, [battleHistory]);

  const { data: cashoutCount = 0 } = useQuery<number>({
    queryKey: ['admin-cashouts-count', user.id],
    queryFn: async () => {
      try {
        const n = await blink.db.cashoutRequests.count({ where: { userId: user.id } });
        return typeof n === 'number' ? n : 0;
      } catch { return 0; }
    }, staleTime: 0,
  });

  // Deposit total: source of truth is transactions table (same as DepositsSection).
  // Includes deposit, first_deposit_bonus, and referral_reward types.
  const { data: depositData = { count: 0, totalValue: 0, bonusValue: 0, referralValue: 0 }, isLoading: depositsLoading } = useQuery<{ count: number; totalValue: number; bonusValue: number; referralValue: number }>({
    queryKey: ['admin-deposits-stats-v3', user.id],
    queryFn: async () => {
      try {
        const rows = await blink.db.transactions.list({ where: { userId: user.id }, limit: 5000 });
        const arr = Array.isArray(rows) ? rows : [];
        let deposits = 0, bonus = 0, referral = 0;
        for (const r of arr) {
          const amt = Math.abs(optNum(r.amount));
          if (r.type === 'deposit') deposits += amt;
          else if (r.type === 'first_deposit_bonus') bonus += amt;
          else if (r.type === 'referral_reward' || r.type === 'referral_signup_bonus') referral += amt;
        }
        return {
          count: arr.filter((r: any) => r.type === 'deposit').length,
          totalValue: deposits,
          bonusValue: bonus,
          referralValue: referral,
        };
      } catch { return { count: 0, totalValue: 0, bonusValue: 0, referralValue: 0 }; }
    }, staleTime: 0,
  });

  // Upgrade count — dedicated count query
  const { data: upgradeCount = 0 } = useQuery<number>({
    queryKey: ['admin-upgrade-count', user.id],
    queryFn: async () => {
      try {
        const n = await blink.db.activityLogs.count({ where: { userId: user.id, type: 'upgrade' } });
        return typeof n === 'number' ? n : 0;
      } catch { return 0; }
    }, staleTime: 0,
  });

  // Exchange count — dedicated count query
  const { data: exchangeCount = 0 } = useQuery<number>({
    queryKey: ['admin-exchange-count', user.id],
    queryFn: async () => {
      try {
        const n = await blink.db.activityLogs.count({ where: { userId: user.id, type: 'exchange' } });
        return typeof n === 'number' ? n : 0;
      } catch { return 0; }
    }, staleTime: 0,
  });

  // Pending cashout count
  const { data: pendingCashouts = 0 } = useQuery<number>({
    queryKey: ['admin-pending-cashouts', user.id],
    queryFn: async () => {
      try {
        const rows = await blink.db.cashoutRequests.list({ where: { userId: user.id, status: 'pending' }, limit: 500 });
        return Array.isArray(rows) ? rows.length : 0;
      } catch { return 0; }
    }, staleTime: 0,
  });

  // ── Paginated activity logs (backend endpoint, supports type filter) ────────

  const { data: logsPage, isLoading } = useQuery<LogsPage>({
    queryKey: ['admin-activity-logs-v2', user.id, page, typeFilter],
    queryFn: async () => {
      // Battle filter uses local battleHistory — skip backend call
      if (typeFilter === 'battle') return { rows: [], total: 0 };

      let url = `${BACKEND}/admin-logs?userId=${encodeURIComponent(user.id)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      if (typeFilter) url += `&type=${encodeURIComponent(typeFilter)}`;

      const res = await fetch(url, { headers: { 'X-Admin-Secret': 'true' } });
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

  // ── When Battles filter is active, build entries from battleHistory ─────────
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

  // ── Build timeline ────────────────────────────────────────────────────────

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

  // ── Stat cards (clickable — single-select type filter toggle) ──────────────

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
      <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display mb-3 flex items-center gap-2">
        <Activity size={12} className="text-[#00c8ff]" />
        Activity &amp; History
        {typeFilter && (
          <span
            className="ml-1 px-1.5 py-0.5 rounded text-[8px] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: '#ffffff10', border: '1px solid #ffffff15', color: '#ffd700' }}
            onClick={() => { setTypeFilter(null); setPage(0); }}
          >
            {typeFilter.replace('_', ' ')} ✕
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
              <p className="text-[12px] font-display font-bold" style={{ color: s.color }}>{s.value}</p>
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
                  {entry.amount && <p className="text-[9px] font-bold font-display" style={{ color: entry.amountColor || entry.color }}>{entry.amount}</p>}
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
