import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Share2, Users, Loader2, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { fetchReferrals, ReferralData, applyReferralCode } from '../../../lib/api';

interface ReferralsTabProps {
  referralCode: string;
}

const panel: React.CSSProperties = {
  background: 'rgba(13,14,20,0.9)',
  border: '1px solid rgba(155,92,255,0.15)',
  boxShadow: '0 0 40px -15px rgba(155,92,255,0.2)',
};

const topLine: React.CSSProperties = {
  background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), rgba(155,92,255,0.7), transparent)',
};

export const ReferralsTab: React.FC<ReferralsTabProps> = ({ referralCode }) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applyResult, setApplyResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [copying, setCopying] = useState(false);

  const loadReferrals = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetchReferrals(p);
      setReferrals(res.data);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals(page);
  }, [page, loadReferrals]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setApplyResult(null);
    try {
      const res = await applyReferralCode(code.trim());
      setApplyResult({ type: 'success', text: res.message });
      setCode('');
    } catch (err: any) {
      setApplyResult({ type: 'error', text: err?.message || 'Failed to apply referral code' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?ref=${referralCode}`;
    const shareData = {
      title: 'Join PocketPull TCG!',
      text: `Join me on PocketPull and open rare Pokemon packs! Use my referral code ${referralCode} and we'll both earn $10 when you make your first deposit of $5 or more.`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopyCode();
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Enter a Referral Code */}
      <div className="relative rounded-2xl overflow-hidden p-6" style={panel}>
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={topLine} />
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(155,92,255,0.15)', border: '1px solid rgba(155,92,255,0.25)' }}
            >
              <Ticket size={18} className="text-[#9b5cff]" />
            </div>
            <div>
              <h3 className="text-xl font-display text-white uppercase tracking-tight">Enter a Referral Code</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                Have a friend's code? Enter it here — both of you earn $10 after your first deposit of $5 or more.
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
              className="flex-1 px-5 py-3.5 rounded-2xl font-mono text-lg font-black tracking-[0.2em] text-[#00c8ff] placeholder-gray-700 focus:outline-none transition-all disabled:opacity-60"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="px-8 py-3.5 rounded-2xl text-black font-bold uppercase tracking-wider text-sm disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 shrink-0"
              style={{ background: 'linear-gradient(to right, #9b5cff, #00c8ff)' }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Apply'}
            </button>
          </form>

          <AnimatePresence mode="wait">
            {applyResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                  applyResult.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {applyResult.type === 'success'
                  ? <CheckCircle2 size={16} className="shrink-0" />
                  : <XCircle size={16} className="shrink-0" />}
                {applyResult.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Your Referral Code */}
      <div className="relative rounded-2xl overflow-hidden p-6" style={panel}>
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={topLine} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-xl font-display text-white uppercase tracking-tight">Your Referral Code</h3>
            <p className="text-sm text-gray-400 max-w-md leading-relaxed">
              Invite friends to PocketPull! You'll <span className="text-green-400 font-bold">both earn $10</span> when they make their first deposit of $5 or more.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div
              className="px-8 py-4 rounded-2xl font-mono text-2xl font-black tracking-[0.2em] text-[#00c8ff] shadow-inner"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {referralCode || '-------'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="w-14 h-14 flex items-center justify-center rounded-2xl text-gray-300 hover:text-white hover:border-white/20 transition-all active:scale-95 shadow-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Copy Code"
              >
                {copying ? <CheckCircle2 size={24} className="text-green-400" /> : <Copy size={24} />}
              </button>

              <button
                onClick={handleShare}
                className="w-14 h-14 flex items-center justify-center rounded-2xl text-[#9b5cff] hover:text-white transition-all active:scale-95 shadow-lg"
                style={{ background: 'rgba(155,92,255,0.1)', border: '1px solid rgba(155,92,255,0.2)' }}
                title="Share Referral"
              >
                <Share2 size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invited Players */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#9b5cff]" />
          <h3 className="text-lg font-display text-white uppercase tracking-tight">Invited Players ({total})</h3>
        </div>

        <div className="relative rounded-2xl overflow-hidden" style={panel}>
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={topLine} />

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="text-[#00c8ff] animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Loading referrals...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-gray-600"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold">You haven't invited any players yet.</p>
                <p className="text-sm text-gray-500">Your friends will show up here once they sign up with your code.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">User / Email</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Deposit ($5+)</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Reward Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrals.map((ref) => (
                    <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{ref.username}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{ref.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${ref.deposited ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-gray-600'}`} />
                          <span className={`text-xs font-medium ${ref.deposited ? 'text-green-400' : 'text-gray-500'}`}>
                            {ref.deposited ? 'Completed' : 'No deposit'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          ref.status === 'Reward Paid'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {ref.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ background: 'rgba(0,0,0,0.2)' }}
                >
                  <p className="text-xs text-gray-500 font-medium">
                    Showing page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
