import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy } from 'lucide-react';
import { getBrawlLeaderboard, type LeagueId } from '../../lib/brawlApi';
import { LEAGUE_COLOR, LEAGUE_LABEL } from './leagueColors';

const LEAGUE_FILTERS: { id: LeagueId | 'all'; label: string }[] = [
  { id: 'all', label: 'All Leagues' }, { id: 'master', label: 'Master' }, { id: 'ultra', label: 'Ultra' }, { id: 'great', label: 'Great' }, { id: 'standard', label: 'Standard' },
];

export function LeaderboardsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['brawl-leaderboard'], queryFn: getBrawlLeaderboard, refetchInterval: 15_000 });
  const [filter, setFilter] = useState<LeagueId | 'all'>('all');
  const rows = data?.leaderboard || [];
  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter(r => r.league === filter)), [rows, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><BarChart3 size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Leaderboards</h3></div>
        <div className="flex gap-1 flex-wrap">
          {LEAGUE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${filter === f.id ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
              style={filter === f.id && f.id !== 'all' ? { color: LEAGUE_COLOR[f.id], background: `${LEAGUE_COLOR[f.id]}20` } : undefined}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/30 text-sm py-16 text-center border border-dashed border-white/10 rounded-xl">
          {rows.length === 0 ? 'Nobody has battled yet — be the first to climb the ladder.' : 'No trainers in this league yet.'}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
              <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Trainer</th><th className="px-3 py-2 text-left">League</th><th className="px-3 py-2 text-right">Rating</th><th className="px-3 py-2 text-right">W-L</th></tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.user_id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/40">{i < 3 ? <Trophy size={13} className="text-[#facc15] inline" /> : i + 1}</td>
                  <td className="px-3 py-2 text-white font-bold">{r.username || 'Trainer'}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: LEAGUE_COLOR[r.league as LeagueId] || '#8892a4' }}>{LEAGUE_LABEL[r.league as LeagueId] || r.league}</td>
                  <td className="px-3 py-2 text-right text-[#00c8ff] font-bold">{r.league_rating}</td>
                  <td className="px-3 py-2 text-right text-white/50">{r.wins}-{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
