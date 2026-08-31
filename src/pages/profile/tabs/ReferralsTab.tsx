import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Users, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchReferrals, ReferralData } from '../../../lib/api';

interface ReferralsTabProps {
  referralCode: string;
}

export const ReferralsTab: React.FC<ReferralsTabProps> = ({ referralCode }) => {
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
      {/* Referral Code Card */}
      <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden group">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#00c8ff]/10 via-transparent to-[#9b5cff]/10 opacity-30" 
        />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h3 className="text-xl font-display text-white uppercase tracking-tight">Your Referral Code</h3>
            <p className="text-sm text-gray-400 max-w-md leading-relaxed">
              Invite your friends to PocketPull! You'll <span className="text-green-400 font-bold">both earn $10</span> when they make their first deposit of $5 or more.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="px-8 py-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-2xl font-black tracking-[0.2em] text-[#00c8ff] shadow-inner">
              {referralCode || '-------'}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 shadow-lg"
                title="Copy Code"
              >
                {copying ? <CheckCircle2 size={24} className="text-green-400" /> : <Copy size={24} />}
              </button>
              
              <button
                onClick={handleShare}
                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#9b5cff]/10 border border-[#9b5cff]/20 text-[#9b5cff] hover:text-white hover:bg-[#9b5cff]/20 hover:border-[#9b5cff]/40 transition-all active:scale-95 shadow-lg"
                title="Share Referral"
              >
                <Share2 size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#9b5cff]" />
            <h3 className="text-lg font-display text-white uppercase tracking-tight">Invited Players ({total})</h3>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="text-[#00c8ff] animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Loading referrals...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-600">
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold">You haven’t invited any players yet.</p>
                <p className="text-sm text-gray-500">Your friends will show up here once they sign up with your code.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
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
                          <div 
                            className={`w-2 h-2 rounded-full ${ref.deposited ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-gray-600'}`} 
                          />
                          <span className={`text-xs font-medium ${ref.deposited ? 'text-green-400' : 'text-gray-500'}`}>
                            {ref.deposited ? 'Completed' : 'No deposit'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            ref.status === 'Reward Paid'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}
                        >
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between bg-black/20">
                  <p className="text-xs text-gray-500 font-medium">
                    Showing page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                  </p>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
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
