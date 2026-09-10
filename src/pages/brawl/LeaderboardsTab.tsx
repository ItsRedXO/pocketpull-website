import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy, ChevronLeft, ChevronRight, Medal } from 'lucide-react';
import { getBrawlLeaderboard } from '../../lib/brawlApi';
import { TrainerDetailModal } from './TrainerDetailModal';

const PAGE_SIZE = 10;
const RANK_COLOR: Record<number, string> = { 1: '#facc15', 2: '#cbd5e1', 3: '#d98950' };

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLOR[rank];
  if (!color) return <span className="text-white/40 font-bold">{rank}</span>;
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px]" style={{ background: `${color}25`, color, border: `1px solid ${color}60` }}>
      {rank}
    </span>
  );
}

export function LeaderboardsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['brawl-leaderboard'], queryFn: getBrawlLeaderboard, refetchInterval: 15_000 });
  const rows = data?.leaderboard || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4"><BarChart3 size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Leaderboards</h3></div>
      {isLoading ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-white/30 text-sm py-16 text-center border border-dashed border-white/10 rounded-xl">
          Nobody has battled yet — be the first to climb the ladder.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
                <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Trainer</th><th className="px-3 py-2 text-right">Global Rating</th><th className="px-3 py-2 text-right">W-L</th></tr>
              </thead>
              <tbody>
                <AnimatePresence mode="wait">
                  {pageRows.map((r, i) => {
                    const rank = (page - 1) * PAGE_SIZE + i + 1;
                    const rankColor = RANK_COLOR[rank];
                    return (
                      <motion.tr key={r.user_id} onClick={() => setSelectedUserId(r.user_id)}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.025 }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        className="border-t border-white/5 cursor-pointer"
                        style={rankColor ? { background: `${rankColor}0a` } : undefined}>
                        <td className="px-3 py-2"><RankBadge rank={rank} /></td>
                        <td className="px-3 py-2 text-white font-bold">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-[#00c8ff] bg-[#1b1d2a]"
                              style={{ border: `1.5px solid ${rankColor || 'rgba(255,255,255,0.12)'}` }}>
                              {r.avatar_url ? <img src={r.avatar_url} alt={r.username || 'Trainer'} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : (r.username || 'T').trim().slice(0, 1).toUpperCase()}
                            </span>
                            <span className="hover:text-[#00c8ff] transition-colors">{r.username || 'Trainer'}</span>
                            {rank === 1 && <Medal size={12} className="text-[#facc15]" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[#00c8ff] font-bold">{r.league_rating}</td>
                        <td className="px-3 py-2 text-right text-white/50">{r.wins}-{r.losses}</td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className={`w-7 h-7 rounded-md flex items-center justify-center ${page === 1 ? 'text-white/15 cursor-default' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <motion.button key={p} onClick={() => setPage(p)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  className={`w-7 h-7 rounded-md text-[11px] font-bold ${p === page ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black shadow-[0_0_10px_rgba(0,200,255,0.35)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                  {p}
                </motion.button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className={`w-7 h-7 rounded-md flex items-center justify-center ${page === totalPages ? 'text-white/15 cursor-default' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
      {selectedUserId && <TrainerDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
}
