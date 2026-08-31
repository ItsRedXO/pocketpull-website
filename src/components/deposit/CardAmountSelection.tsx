import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Loader2, AlertCircle, ShieldCheck, Gift } from 'lucide-react';
import { PRESET_AMOUNTS } from './DepositConstants';
import { Label, SecurityBadge } from './DepositHelpers';

interface CardAmountSelectionProps {
  amount: number;
  custom: string;
  setAmount: (amt: number) => void;
  setCustom: (val: string) => void;
  intentError: string;
  setIntentError: (err: string) => void;
  creatingIntent: boolean;
  proceedToPayment: () => void;
  effectiveAmt: number;
  hasDeposited: boolean | null;
}

export const CardAmountSelection: React.FC<CardAmountSelectionProps> = ({
  amount,
  custom,
  setAmount,
  setCustom,
  intentError,
  setIntentError,
  creatingIntent,
  proceedToPayment,
  effectiveAmt,
  hasDeposited,
}) => {
  return (
    <div className="space-y-5">
      <div>
        <Label>Select Amount</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {PRESET_AMOUNTS.map(a => {
            const sel = amount === a && !custom;
            return (
              <motion.button key={a}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { setAmount(a); setCustom(''); setIntentError(''); }}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: sel ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${sel ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: sel ? '#00c8ff' : '#9ca3af',
                  boxShadow: sel ? '0 0 16px -4px rgba(0,200,255,0.45)' : 'none',
                }}>
                ${a}
              </motion.button>
            );
          })}
        </div>
        {/* Custom amount */}
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">$</span>
          <input
            type="number" min="5" placeholder="Custom amount (min $5)"
            value={custom}
            onChange={e => { setCustom(e.target.value); setAmount(0); setIntentError(''); }}
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-sm text-white pl-7 placeholder:text-white/20 focus:outline-none focus:border-[#00c8ff]/50 focus:ring-1 focus:ring-[#00c8ff]/20 transition-all"
          />
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {intentError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{intentError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-deposit promo banner */}
      <AnimatePresence>
        {hasDeposited === false && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,200,255,0.08), rgba(155,92,255,0.06))',
              border: '1px solid rgba(0,200,255,0.2)',
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.25)' }}>
              <Gift size={15} className="text-[#00c8ff]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#00c8ff]">We match your first deposit up to $100!</p>
              <p className="text-[10px] text-white/40">Deposit $50 and we'll give you $50 in bonus funds. One-time offer.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proceed to payment button */}
      <motion.button
        whileHover={!creatingIntent ? { scale: 1.02, y: -1 } : {}}
        whileTap={!creatingIntent ? { scale: 0.97 } : {}}
        onClick={proceedToPayment}
        disabled={creatingIntent || effectiveAmt < 5}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-display text-base uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shimmer-btn"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          boxShadow: '0 0 28px -6px rgba(16,185,129,0.65)',
          color: '#fff',
        }}
      >
        {creatingIntent ? (
          <><Loader2 size={16} className="animate-spin" />Preparing Payment…</>
        ) : (
          <><CreditCard size={16} />Pay ${effectiveAmt >= 5 ? effectiveAmt.toFixed(2) : '—'} with Card</>
        )}
      </motion.button>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <SecurityBadge icon={<ShieldCheck size={11} />} label="SSL Encrypted" />
        <SecurityBadge icon={<CreditCard size={11} />} label="Stripe Payments" />
        <SecurityBadge icon={<ShieldCheck size={11} />} label="PCI Compliant" />
      </div>
    </div>
  );
};
