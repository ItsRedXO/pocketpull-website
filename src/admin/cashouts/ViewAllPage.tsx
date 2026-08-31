import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Printer, Package, RefreshCw, Layers,
} from 'lucide-react';
import { blink } from '../../lib/blink';
import { CashoutCard, CashoutRequest, GroupedCard } from './CashoutTypes';
import { fmt, groupCards, parseCards } from './CashoutHelpers';
import { generateAllPdf } from './PdfUtils';

interface ViewAllPageProps {
  onBack: () => void;
}

export const ViewAllPage: React.FC<ViewAllPageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<GroupedCard[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await blink.db.cashoutRequests.list({
          where: { status: 'pending' },
          limit: 10000,
        }) as CashoutRequest[];

        const allCards: CashoutCard[] = [];
        let tv = 0;
        for (const r of rows) {
          const cards = parseCards(r.cardsJson || '[]');
          allCards.push(...cards);
          tv += Number(r.totalValue) || 0;
        }
        setGrouped(groupCards(allCards));
        setTotalValue(tv);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#9b5cff', background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.2)' }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-[#9b5cff]" /> All Pending Cashout Cards
            </h2>
            <p className="text-[11px] text-white/40 mt-0.5">Combined master pull list — all pending requests</p>
          </div>
        </div>
        <button
          onClick={() => generateAllPdf(grouped, totalValue)}
          disabled={grouped.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <Printer size={13} /> Print All Cashout Cards
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <RefreshCw size={22} className="text-white/20 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-20 text-center">
          <Package size={40} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/30 text-sm">No pending cashout cards.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Stats bar */}
          <div className="px-5 py-3 flex items-center gap-6"
            style={{ background: 'rgba(155,92,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[11px] text-white/50">{grouped.length} unique cards</span>
            <span className="text-[11px] text-white/50">{grouped.reduce((a, c) => a + c.quantity, 0)} total copies</span>
            <span className="text-[11px] font-bold" style={{ color: '#10b981' }}>Total: {fmt(totalValue)}</span>
          </div>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Card Name', 'Total Qty', 'Total Value'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((c, i) => (
                  <tr key={c.card_name}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-5 py-3 text-sm text-white/80 font-medium">{c.card_name}</td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-bold text-white/60">×{c.quantity}</span>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: c.value > 0 ? '#10b981' : '#ffffff40' }}>
                      {c.value > 0 ? fmt(c.value) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
