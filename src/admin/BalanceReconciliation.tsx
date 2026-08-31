import React from 'react';
import { Scale, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { blink } from '../lib/blink';
import { UserRow } from './types';
import { useQuery } from '@tanstack/react-query';

interface Props {
  user: UserRow;
}

function optNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

interface ReconLine {
  label: string;
  amount: number;
  color: string;
}

export function BalanceReconciliation({ user }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-balance-recon', user.id],
    queryFn: async () => {
      // ── Use wallet_transactions as the single balance ledger ──
      let walletTxns: any[] = [];
      try {
        const rows = await blink.db.walletTransactions.list({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          limit: 1000,
        });
        walletTxns = Array.isArray(rows) ? rows : [];
      } catch { /* table may not exist */ }

      // Categorize every wallet transaction
      let depositsTotal = 0;
      let sellsTotal = 0;
      let bonusTotal = 0;
      let referralTotal = 0;
      let packSpend = 0;
      let battleEntries = 0;
      let battleRefunds = 0;
      let exchangeRefunds = 0;
      let upgraderLosses = 0;
      let cashoutValue = 0;
      let adminCredits = 0;
      let adminDebits = 0;

      for (const wt of walletTxns) {
        const amt = Math.abs(optNum(wt.amount));
        const isDebit = optNum(wt.amount) < 0;
        switch (wt.type) {
          case 'deposit': depositsTotal += amt; break;
          case 'first_deposit_bonus': bonusTotal += amt; break;
          case 'referral_reward': referralTotal += amt; break;
          case 'sell':
          case 'sell_all': sellsTotal += amt; break;
          case 'pack_open': packSpend += amt; break;
          case 'battle_entry': battleEntries += amt; break;
          case 'battle_cancel':
          case 'battle_entry_refund': battleRefunds += amt; break;
          case 'exchange_refund': exchangeRefunds += amt; break;
          case 'admin_credit': adminCredits += amt; break;
          case 'admin_debit': adminDebits += amt; break;
          case 'upgrade': if (isDebit) upgraderLosses += amt; break;
          default: break;
        }
      }

      // Also pull upgrader_spins and cashouts for display counts
      let upgraderSpins: any[] = [];
      try {
        const rows = await blink.db.table('upgraderSpins').list({
          where: { userId: user.id }, limit: 5000,
        });
        upgraderSpins = Array.isArray(rows) ? rows : [];
      } catch { /* fall through */ }

      let cashouts: any[] = [];
      try {
        const rows = await blink.db.cashoutRequests.list({
          where: { userId: user.id }, limit: 500,
        });
        cashouts = Array.isArray(rows) ? rows : [];
      } catch { /* fall through */ }

      for (const co of cashouts) {
        cashoutValue += optNum(co.totalValue || co.total_value);
      }

      const lastWT = walletTxns.length > 0 ? walletTxns[0] : null;
      const expectedBalance = lastWT ? optNum(lastWT.balanceAfter || lastWT.balance_after) : 0;
      const actualBalance = optNum(user.balance);
      const diff = actualBalance - expectedBalance;

      const credits: ReconLine[] = [
        { label: 'Deposits', amount: depositsTotal, color: '#10b981' },
        { label: 'Card Sales', amount: sellsTotal, color: '#f59e0b' },
        ...(bonusTotal > 0 ? [{ label: 'First Deposit Match', amount: bonusTotal, color: '#06b6d4' }] : []),
        ...(referralTotal > 0 ? [{ label: 'Referral Rewards', amount: referralTotal, color: '#8b5cf6' }] : []),
        ...(battleRefunds > 0 ? [{ label: 'Battle Refunds', amount: battleRefunds, color: '#6b7280' }] : []),
        ...(exchangeRefunds > 0 ? [{ label: 'Exchange Refunds', amount: exchangeRefunds, color: '#6b7280' }] : []),
        ...(adminCredits > 0 ? [{ label: 'Admin Credits', amount: adminCredits, color: '#6b7280' }] : []),
      ];

      const debits: ReconLine[] = [
        ...(packSpend > 0 ? [{ label: 'Pack Openings', amount: packSpend, color: '#9b5cff' }] : []),
        ...(battleEntries > 0 ? [{ label: 'Battle Entries', amount: battleEntries, color: '#f87171' }] : []),
        ...(upgraderLosses > 0 ? [{ label: 'Upgrader Losses', amount: upgraderLosses, color: '#ffd700' }] : []),
        ...(cashoutValue > 0 ? [{ label: 'Cashouts', amount: cashoutValue, color: '#f59e0b' }] : []),
        ...(adminDebits > 0 ? [{ label: 'Admin Debits', amount: adminDebits, color: '#6b7280' }] : []),
      ];

      const totalCredits = credits.reduce((sum, line) => sum + line.amount, 0);
      const totalDebits = debits.reduce((sum, line) => sum + line.amount, 0);

      return {
        credits, totalCredits,
        debits, totalDebits,
        expectedBalance,
        actualBalance,
        diff,
        walletTxnCount: walletTxns.length,
        upgradeCount: upgraderSpins.length,
        cashoutCount: cashouts.length,
      };
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Scale size={12} className="text-[#00c8ff]" />
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display">Balance Reconciliation</h4>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { credits, totalCredits, debits, totalDebits, expectedBalance, actualBalance, diff } = data;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Scale size={12} className="text-[#00c8ff]" />
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display">Balance Reconciliation</h4>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-[10px] text-green-400/60 uppercase tracking-wider">Credits</p>
          <p className="text-xs font-display font-bold text-green-400">${totalCredits.toFixed(2)}</p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-[10px] text-red-400/60 uppercase tracking-wider">Debits</p>
          <p className="text-xs font-display font-bold text-red-400">${totalDebits.toFixed(2)}</p>
        </div>
        <div className={`rounded-lg p-2 text-center ${Math.abs(diff) < 0.02 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            {Math.abs(diff) < 0.02 ? 'Balanced' : 'Drift'}
          </p>
          <p className={`text-xs font-display font-bold ${Math.abs(diff) < 0.02 ? 'text-green-400' : 'text-amber-400'}`}>
            {Math.abs(diff) < 0.02 ? (
              <span className="flex items-center justify-center gap-1"><CheckCircle size={10} />OK</span>
            ) : (
              <span className="flex items-center justify-center gap-1"><AlertTriangle size={10} />${diff.toFixed(2)}</span>
            )}
          </p>
        </div>
      </div>

      {/* Line items */}
      <div className="flex gap-4">
        {/* Credits column */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingUp size={10} className="text-green-400" />
            <span className="text-[9px] text-green-400/70 uppercase tracking-wider font-bold">In</span>
          </div>
          <div className="space-y-0.5">
            {credits.map(line => (
              <div key={line.label} className="flex items-center justify-between text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-white/60">{line.label}</span>
                <span className="font-mono font-bold" style={{ color: line.color }}>+${line.amount.toFixed(2)}</span>
              </div>
            ))}
            {credits.length === 0 && <p className="text-[9px] text-white/10 text-center py-1">None</p>}
            <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <span className="text-green-400 font-bold">Total In</span>
              <span className="font-mono font-bold text-green-400">${totalCredits.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Debits column */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingDown size={10} className="text-red-400" />
            <span className="text-[9px] text-red-400/70 uppercase tracking-wider font-bold">Out</span>
          </div>
          <div className="space-y-0.5">
            {debits.map(line => (
              <div key={line.label} className="flex items-center justify-between text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-white/60">{line.label}</span>
                <span className="font-mono font-bold" style={{ color: line.color }}>-${line.amount.toFixed(2)}</span>
              </div>
            ))}
            {debits.length === 0 && <p className="text-[9px] text-white/10 text-center py-1">None</p>}
            <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <span className="text-red-400 font-bold">Total Out</span>
              <span className="font-mono font-bold text-red-400">${totalDebits.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom line: expected vs actual */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
        <div>
          <span className="text-white/30">Expected: </span>
          <span className="font-mono font-bold text-white">${expectedBalance.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-white/30">Actual: </span>
          <span className="font-mono font-bold" style={{ color: Math.abs(diff) < 0.02 ? '#10b981' : '#f59e0b' }}>
            ${actualBalance.toFixed(2)}
          </span>
        </div>
        {Math.abs(diff) >= 0.02 && (
          <div>
            <span className="text-white/20">Drift: </span>
            <span className="font-mono font-bold text-amber-400">${diff.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}