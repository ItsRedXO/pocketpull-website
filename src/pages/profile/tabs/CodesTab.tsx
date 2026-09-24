import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { applyReferralCode } from '../../../lib/api';

export const CodesTab: React.FC = () => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await applyReferralCode(code.trim());
      setResult({ type: 'success', text: res.message });
      setCode('');
    } catch (err: any) {
      setResult({ type: 'error', text: err?.message || 'Failed to apply referral code' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00c8ff]/10 via-transparent to-[#9b5cff]/10 opacity-30" />

        <div className="relative space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#9b5cff]/15 border border-[#9b5cff]/25 flex items-center justify-center shrink-0">
              <Users size={18} className="text-[#9b5cff]" />
            </div>
            <div>
              <h3 className="text-xl font-display text-white uppercase tracking-tight">Apply a Referral Code</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                Have a friend's referral code? Enter it here — both of you earn a reward after your first deposit.
              </p>
            </div>
          </div>

          <form onSubmit={handleApply} className="flex flex-col sm:flex-row gap-3">
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ENTER REFERRAL CODE"
              maxLength={32}
              disabled={submitting}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-black/40 border border-white/10 font-mono text-lg font-black tracking-[0.2em] text-[#00c8ff] placeholder-gray-700 focus:outline-none focus:border-[#00c8ff]/50 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold uppercase tracking-wider text-sm disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 shrink-0"
            >
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Apply'}
            </button>
          </form>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                  result.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {result.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
                {result.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
