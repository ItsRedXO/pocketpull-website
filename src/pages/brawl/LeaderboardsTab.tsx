import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy } from 'lucide-react';
import { getBrawlLeaderboard } from '../../lib/brawlApi';
import { TrainerDetailModal } from './TrainerDetailModal';

export function LeaderboardsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['brawl-leaderboard'], queryFn: getBrawlLeaderboard, refetchInterval: 15_000 });
  const rows = data?.leaderboard || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
        <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
              <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Trainer</th><th className="px-3 py-2 text-right">Global Rating</th><th className="px-3 py-2 text-right">W-L</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.user_id} onClick={() => setSelectedUserId(r.user_id)}
                  className="border-t border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                  <td className="px-3 py-2 text-white/40">{i < 3 ? <Trophy size={13} className="text-[#facc15] inline" /> : i + 1}</td>
                  <td className="px-3 py-2 text-white font-bold">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#1b1d2a] text-[9px] font-bold text-[#00c8ff]">
                        {r.avatar_url ? <img src={r.avatar_url} alt={r.username || 'Trainer'} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : (r.username || 'T').trim().slice(0, 1).toUpperCase()}
                      </span>
                      <span className="hover:text-[#00c8ff] transition-colors">{r.username || 'Trainer'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-[#00c8ff] font-bold">{r.league_rating}</td>
                  <td className="px-3 py-2 text-right text-white/50">{r.wins}-{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedUserId && <TrainerDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
}
