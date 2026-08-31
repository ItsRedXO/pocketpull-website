import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { blink } from '../lib/blink';

export function StatsTab() {
  const qc = useQueryClient();
  const { data: stats, isLoading, isRefetching } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Fetch counts using standard SDK methods
      const [totalUsers, totalPulls, totalPacks, packs, allUsers, depositTransactions, packOpens] = await Promise.all([
        blink.db.users.count({ where: { isDeleted: 0 } }),
        blink.db.packsOpened.count(),
        blink.db.packsCatalog.count(),
        blink.db.packsCatalog.list({ limit: 100 }),
        blink.db.users.list({ where: { isDeleted: 0 }, limit: 5000 }), // Increased limit for summing
        blink.db.transactions.list({ where: { type: 'deposit' }, limit: 5000 }),
        blink.db.packsOpened.list({ limit: 5000 }),
      ]);

      // Calculate total revenue from actual Stripe deposits
      const totalRevenue = (depositTransactions as any[]).reduce(
        (acc, t) => acc + (Number(t.amount) || 0),
        0
      );

      // Calculate total user balances
      const totalBalance = (allUsers as any[]).reduce(
        (acc, u) => acc + (Number(u.balance) || 0),
        0
      );

      // Map pack-specific opens
      const packOpensMap: Record<string, number> = {};
      (packOpens as any[]).forEach((po) => {
        packOpensMap[po.packId] = (packOpensMap[po.packId] || 0) + 1;
      });

      const activePacks = (packs as any[]).filter(p => Number(p.isActive) > 0).length;
      const packBreakdown = (packs as any[]).map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        opens: packOpensMap[p.id] || 0,
        active: Number(p.isActive) > 0,
      })).sort((a, b) => b.opens - a.opens);

      return {
        totalUsers,
        totalPulls,
        totalRevenue,
        totalBalance,
        activePacks,
        totalPacks,
        packBreakdown,
      };
    },
    staleTime: 0,
    refetchInterval: 3000,
  });

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, color: '#9b5cff', prefix: '' },
    { label: 'Packs Opened', value: stats?.totalPulls ?? 0, color: '#00c8ff', prefix: '' },
    { label: 'Total Revenue', value: stats?.totalRevenue?.toFixed(2) ?? '0.00', color: '#10b981', prefix: '$' },
    { label: 'User Balances', value: stats?.totalBalance?.toFixed(2) ?? '0.00', color: '#f59e0b', prefix: '$' },
    { label: 'Active Packs', value: stats?.activePacks ?? 0, color: '#ff00ff', prefix: '' },
    { label: 'Total Packs', value: stats?.totalPacks ?? 0, color: '#8892a4', prefix: '' },
  ];

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wider text-white">Site Statistics</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Live overview of platform performance</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all disabled:opacity-30"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {cards.map(c => (
            <div key={c.label} className="rounded-2xl p-4 text-center"
              style={{ background: `${c.color}08`, border: `1.5px solid ${c.color}22` }}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">{c.label}</p>
              <p className="text-2xl font-display font-bold" style={{ color: c.color }}>
                {c.prefix}{typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {stats?.packBreakdown && stats.packBreakdown.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display mb-3">Pack Performance</h3>
          <div className="flex flex-col gap-2">
            {stats.packBreakdown.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${p.active ? 'text-green-400' : 'text-white/20'}`}
                  style={{ background: p.active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)' }}>
                  {p.active ? 'LIVE' : 'OFF'}
                </span>
                <span className="text-[12px] text-white flex-1">{p.name}</span>
                <span className="text-[11px] text-white/40">${p.price.toFixed(2)}</span>
                <span className="text-[12px] font-bold" style={{ color: '#00c8ff' }}>{p.opens} opens</span>
                <span className="text-[11px] font-bold" style={{ color: '#10b981' }}>
                  ${(p.opens * p.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
