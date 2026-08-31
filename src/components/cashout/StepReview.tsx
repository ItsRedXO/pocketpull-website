import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ChevronLeft, AlertCircle } from 'lucide-react';
import { InventoryItem, ShippingForm } from './types';
import { rarityColor } from './shared';

interface Props {
  selected: InventoryItem[];
  form: ShippingForm;
  submitting: boolean;
  submitError: string;
  onBack: () => void;
  onSubmit: () => void;
}

export const StepReview: React.FC<Props> = ({ selected, form, submitting, submitError, onBack, onSubmit }) => {
  const totalValue = selected.reduce((s, c) => s + c.value, 0);

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.2)' }}>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Total Cards</p>
          <p className="font-display text-2xl text-white">{selected.length}</p>
        </div>
        <div className="px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Total Value</p>
          <p className="font-display text-2xl" style={{ color: '#10b981' }}>${totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Shipping summary */}
      <div className="px-4 py-3 rounded-xl space-y-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Shipping To</p>
        <p className="text-sm text-white font-semibold">{form.name}</p>
        <p className="text-xs text-gray-400">{form.address}</p>
        <p className="text-xs text-gray-400">{form.city}, {form.state} {form.zip}</p>
        <p className="text-xs text-gray-500 mt-1">{form.email} · {form.phone}</p>
      </div>

      {/* Cards list individual rows */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Selected Cards</p>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {selected.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                {/* Card Image Thumbnail */}
                <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 border border-white/5 bg-black/40">
                  {item.cardImageUrl ? (
                    <img src={item.cardImageUrl} alt={item.cardName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg bg-white/5">
                      {item.emoji ?? '🃏'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{item.cardName}</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 inline-block" 
                    style={{ background: `${rarityColor(item.rarity)}15`, color: rarityColor(item.rarity) }}>
                    {item.rarity}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold" style={{ color: '#10b981' }}>${item.value.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
          <p className="text-xs text-red-400">{submitError}</p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} disabled={submitting}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ChevronLeft size={15} /> Back
        </button>
        <motion.button whileHover={!submitting ? { scale: 1.02, y: -1 } : {}} whileTap={!submitting ? { scale: 0.97 } : {}}
          onClick={onSubmit} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-display text-base uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: submitting ? 'none' : '0 0 28px -6px rgba(16,185,129,0.6)', color: '#fff' }}>
          {submitting ? <><Loader2 size={16} className="animate-spin" />Submitting…</> : 'Submit Cashout Request'}
        </motion.button>
      </div>
    </motion.div>
  );
};
