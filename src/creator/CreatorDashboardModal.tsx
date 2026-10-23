import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Copy, Share2, CheckCircle2, Loader2, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCreatorDashboard, requestCreatorPayout, CreatorReferral, fetchDailyAllowance, applyDailyAllowance } from '../lib/creatorApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  referralCode: string;
}

const PAYOUT_TIERS = [
  { range: '$5 – $8.99',   payout: '$1' },
  { range: '$9 – $14.99',  payout: '$2' },
  { range: '$15 – $24.99', payout: '$3' },
  { range: '$25 – $39.99', payout: '$5' },
  { range: '$40 – $54.99', payout: '$6' },
  { range: '$55 – $65.99', payout: '$7' },
  { range: '$66 – $99.99', payout: '$8' },
  { range: '$100+',        payout: '$10' },
];

export const CreatorDashboardModal: React.FC<Props> = ({ isOpen, onClose, userId, referralCode }) => {
  const [copied, setCopied] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showTiers, setShowTiers] = useState(false);
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [applyingAllowance, setApplyingAllowance] = useState(false);
  const [allowanceResult, setAllowanceResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['creator-dashboard', userId],
    queryFn: fetchCreatorDashboard,
    enabled: isOpen && !!userId,
    staleTime: 30_000,
  });

  const { data: allowance, refetch: refetchAllowance } = useQuery({
    queryKey: ['creator-daily-allowance', userId],
    queryFn: fetchDailyAllowance,
    enabled: isOpen && !!userId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const handleCopy = () => {
    const code = data?.referralCode || referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const code = data?.referralCode || referralCode;
    const url = `${window.location.origin}?ref=${code}`;
    if (navigator.share) {
      navigator.share({ title: 'Join PocketPull!', text: `Use my creator code ${code} when you sign up!`, url });
    } else {
      handleCopy();
    }
  };

  const handleRequestPayout = async () => {
    if (!paymentMethod || !paymentDetails.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await requestCreatorPayout(paymentMethod, paymentDetails.trim());
      setSubmitResult({ ok: true, msg: `Payout request for $${res.amount.toFixed(2)} submitted! We'll process it soon.` });
      setShowPayoutForm(false);
      setPaymentMethod('');
      setPaymentDetails('');
      refetch();
    } catch (err: any) {
      setSubmitResult({ ok: false, msg: err?.message || 'Failed to submit request' });
    }
    setSubmitting(false);
  };

  const handleApplyAllowance = async () => {
    const amt = parseFloat(allowanceAmount);
    if (!amt || amt <= 0) return;
    setApplyingAllowance(true);
    setAllowanceResult(null);
    try {
      const res = await applyDailyAllowance(amt);
      setAllowanceResult({ ok: true, msg: `$${amt.toFixed(2)} added to your wallet!` });
      setAllowanceAmount('');
      refetchAllowance();
      qc.invalidateQueries({ queryKey: ['user-stats'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    } catch (err: any) {
      setAllowanceResult({ ok: false, msg: err?.message || 'Failed to apply allowance' });
    }
    setApplyingAllowance(false);
  };

  const xpPct = data ? Math.min(100, (data.xp / data.xpToNextLevel) * 100) : 0;
  const depositorCount = data?.referrals.filter(r => r.hasDeposited).length ?? 0;
  const code = data?.referralCode || referralCode || '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: '#0d0f1c', border: '1px solid rgba(251,191,36,0.25)', boxShadow: '0 0 60px rgba(251,191,36,0.08)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/5" style={{ background: 'rgba(13,15,28,0.95)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  <Star size={15} style={{ color: '#fbbf24' }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Creator Dashboard</h2>
                  <p className="text-[10px] text-white/30">Referral Program — Level 1</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin" style={{ color: '#fbbf24' }} />
                </div>
              )}

              {isError && (
                <div className="rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  Failed to load dashboard. Please try again.
                </div>
              )}

              {data && (
                <>
                  {/* XP Bar */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Creator</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                          Level {data.level}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono">${data.xp.toFixed(0)} / ${data.xpToNextLevel} XP</span>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${xpPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                      />
                    </div>
                    <p className="text-[9px] text-white/20 mt-1.5">XP earned from your referrals' deposits. Level 2 unlocks higher payouts.</p>
                  </div>

                  {/* Daily Allowance */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.15)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.25)' }}>
                        <Zap size={12} style={{ color: '#00c8ff' }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#00c8ff' }}>Daily Allowance</span>
                    </div>

                    {allowance ? (
                      <>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <span className="text-2xl font-black" style={{ color: allowance.remaining > 0 ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                              ${allowance.used.toFixed(0)}
                            </span>
                            <span className="text-sm font-bold text-white/30"> / ${allowance.limit}</span>
                          </div>
                          <span className="text-[10px] text-white/30 font-mono">${allowance.remaining.toFixed(2)} remaining</span>
                        </div>
                        <div className="relative h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (allowance.used / allowance.limit) * 100)}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ background: allowance.remaining > 0 ? 'linear-gradient(90deg, #0ea5e9, #00c8ff)' : 'rgba(255,255,255,0.15)' }}
                          />
                        </div>

                        {allowance.remaining > 0 ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max={allowance.remaining}
                              step="0.01"
                              value={allowanceAmount}
                              onChange={e => { setAllowanceAmount(e.target.value); setAllowanceResult(null); }}
                              placeholder={`Enter amount (max $${allowance.remaining.toFixed(2)})`}
                              className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
                              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,200,255,0.15)' }}
                            />
                            <button
                              onClick={handleApplyAllowance}
                              disabled={applyingAllowance || !allowanceAmount || parseFloat(allowanceAmount) <= 0}
                              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30"
                              style={{ background: 'rgba(0,200,255,0.12)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.25)' }}
                            >
                              {applyingAllowance ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-white/25">Daily allowance used. Resets at midnight PST.</p>
                        )}

                        {allowanceResult && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 ${allowanceResult.ok ? 'text-cyan-400' : 'text-red-400'}`}
                            style={{ background: allowanceResult.ok ? 'rgba(0,200,255,0.07)' : 'rgba(248,113,113,0.08)', border: `1px solid ${allowanceResult.ok ? 'rgba(0,200,255,0.2)' : 'rgba(248,113,113,0.2)'}` }}
                          >
                            {allowanceResult.ok && <CheckCircle2 size={11} />}
                            {allowanceResult.msg}
                          </motion.div>
                        )}

                        <p className="text-[9px] text-white/20 mt-2">Resets daily at midnight PST. Wallet balance clears at reset, cards are kept.</p>
                      </>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={18} className="animate-spin" style={{ color: '#00c8ff' }} />
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Earned', value: `$${data.totalEarned.toFixed(2)}`, color: '#10b981' },
                      { label: 'Referrals', value: String(data.referrals.length), color: '#fbbf24' },
                      { label: 'Deposited', value: String(depositorCount), color: '#60a5fa' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Referral Code */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Your Referral Code</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-4 py-2.5 rounded-xl font-mono text-xl font-black tracking-widest text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                        {code}
                      </div>
                      <button onClick={handleCopy} className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white transition-colors shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} title="Copy">
                        {copied ? <CheckCircle2 size={17} className="text-green-400" /> : <Copy size={17} />}
                      </button>
                      <button onClick={handleShare} className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }} title="Share">
                        <Share2 size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Referrals Table */}
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Your Referrals ({data.referrals.length})</p>
                    {data.referrals.length === 0 ? (
                      <div className="rounded-xl py-8 text-center text-white/20 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        No referrals yet. Share your code to get started!
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <table className="w-full text-left">
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-white/30">Username</th>
                              <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-white/30">Joined</th>
                              <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-white/30">1st Deposit</th>
                              <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-white/30">You Earn</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.referrals.map((ref: CreatorReferral, i: number) => (
                              <tr key={ref.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                                <td className="px-4 py-2.5 text-xs font-bold text-white/80">{ref.username}</td>
                                <td className="px-4 py-2.5 text-[10px] text-white/40">
                                  {ref.signedUpAt ? new Date(ref.signedUpAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-[11px] font-mono">
                                  {ref.firstDepositAmount !== null
                                    ? <span className="text-green-400">${ref.firstDepositAmount.toFixed(2)}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-[11px] font-bold">
                                  {ref.payoutEarned > 0
                                    ? <span style={{ color: '#fbbf24' }}>${ref.payoutEarned.toFixed(0)}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Payout Structure (collapsible) */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => setShowTiers(t => !t)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Payout Structure — Level 1</span>
                      {showTiers ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                    </button>
                    <AnimatePresence>
                      {showTiers && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-px p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {PAYOUT_TIERS.map(tier => (
                              <div key={tier.range} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <span className="text-[10px] text-white/40">{tier.range}</span>
                                <span className="text-[11px] font-bold" style={{ color: '#fbbf24' }}>{tier.payout}</span>
                              </div>
                            ))}
                          </div>
                          <p className="px-4 pb-3 text-[9px] text-white/20 leading-relaxed">
                            Each user qualifies for one referral payout based on their first deposit. Chargebacks and refunds are excluded.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Payout Section */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-white/30">Available for Payout</p>
                        <p className="text-2xl font-bold mt-0.5" style={{ color: data.availableForPayout >= 25 ? '#10b981' : '#fff' }}>
                          ${data.availableForPayout.toFixed(2)}
                        </p>
                        {data.totalPaidOut > 0 && (
                          <p className="text-[9px] text-white/30 mt-0.5">${data.totalPaidOut.toFixed(2)} already paid out</p>
                        )}
                      </div>
                      {!showPayoutForm && (
                        <button
                          onClick={() => { setShowPayoutForm(true); setSubmitResult(null); }}
                          disabled={!data.canRequestPayout}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          style={data.canRequestPayout
                            ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                            : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {data.hasPendingRequest ? 'Request Pending' : 'Request Payout'}
                        </button>
                      )}
                    </div>

                    {!data.canRequestPayout && !data.hasPendingRequest && (
                      <p className="text-[10px] text-white/25">Minimum $25 required to request a payout.</p>
                    )}

                    {data.hasPendingRequest && (
                      <div className="text-[10px] px-3 py-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.15)' }}>
                        You have a pending payout request. We'll process it soon!
                      </div>
                    )}

                    <AnimatePresence>
                      {showPayoutForm && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1.5">Payment Method</label>
                              <div className="flex gap-2">
                                {['PayPal', 'Venmo', 'Cash App'].map(m => (
                                  <button
                                    key={m}
                                    onClick={() => setPaymentMethod(m)}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                    style={paymentMethod === m
                                      ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }
                                      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] uppercase tracking-widest text-white/30 block mb-1.5">
                                {paymentMethod === 'PayPal' ? 'PayPal Email' : paymentMethod === 'Venmo' ? 'Venmo @handle' : paymentMethod === 'Cash App' ? 'Cash App $tag' : 'Account / Handle'}
                              </label>
                              <input
                                value={paymentDetails}
                                onChange={e => setPaymentDetails(e.target.value)}
                                placeholder={paymentMethod === 'PayPal' ? 'you@email.com' : '@yourhandle'}
                                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none"
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setShowPayoutForm(false); setPaymentMethod(''); setPaymentDetails(''); }}
                                className="flex-1 py-2 rounded-lg text-xs font-bold text-white/40 hover:text-white transition-colors"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleRequestPayout}
                                disabled={submitting || !paymentMethod || !paymentDetails.trim()}
                                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                              >
                                {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Submit — $${data.availableForPayout.toFixed(2)}`}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {submitResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${submitResult.ok ? 'text-green-400' : 'text-red-400'}`}
                        style={{ background: submitResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${submitResult.ok ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.2)'}` }}
                      >
                        {submitResult.ok ? <CheckCircle2 size={12} /> : null}
                        {submitResult.msg}
                      </motion.div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
