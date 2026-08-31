import React from 'react';
import { CreditCard } from 'lucide-react';
import { blink } from '../lib/blink';
import { UserRow } from './types';
import { useQuery } from '@tanstack/react-query';

interface DepositsSectionProps {
  user: UserRow;
}

export function DepositsSection({ user }: DepositsSectionProps) {
  const { data: deposits = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-deposits', user.id],
    queryFn: async () => {
      const rows = await blink.db.transactions.list({
        where: { userId: user.id, type: 'deposit' },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      });
      return (rows || []).map((r: any) => ({
        ...r,
        amount: Number(r.amount) || 0,
      }));
    },
    staleTime: 15_000,
  });

  const totalDeposits = deposits.reduce((sum: number, d: any) => sum + d.amount, 0);

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display flex items-center gap-2">
          <CreditCard size={12} className="text-green-400" />
          Deposits
        </h4>
        <span className="text-[10px] font-bold font-display text-green-400/80 tracking-wider">
          Total: ${totalDeposits.toFixed(2)}
        </span>
      </div>

      {deposits.length === 0 ? (
        <p className="text-[11px] text-white/20 text-center py-4">No deposits yet.</p>
      ) : (
        <div
          className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {deposits.map((d: any, i: number) => (
            <div
              key={d.id || i}
              className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.08)' }}
            >
              <div>
                <p className="text-[11px] text-white/80">
                  {d.description || 'Deposit'}
                </p>
                <p className="text-[9px] text-white/30">
                  {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
              <span className="text-[11px] font-bold font-display text-green-400">
                +${d.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
