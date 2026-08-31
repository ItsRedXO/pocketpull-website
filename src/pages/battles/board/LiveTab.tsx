import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Shield } from 'lucide-react';
import { BattleWithPlayers } from '../battleTypes';
import { BattleCard, EmptyState } from './BattleCard';
import { MODE_INFO } from '../battleUtils';

type SortOption = 'newest' | 'highest' | 'lowest' | 'players';
type FilterMode = 'all' | 'standard' | 'underdog' | 'shared';

interface LiveTabProps {
  battles: BattleWithPlayers[];
  allBattles: BattleWithPlayers[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  filterMode: FilterMode;
  setFilterMode: (v: FilterMode) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onJoinPrivateBattle: (code: string) => Promise<void>;
  currentUserId?: string;
  isAdmin?: boolean;
  onJoinBattle: (id: string, teamSide?: 'left' | 'right') => void | Promise<void>;
  onWatchBattle: (id: string) => void;
  onCreateBattle: () => void;
  onRefresh?: () => void;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
}

export const LiveTab: React.FC<LiveTabProps> = ({
  battles,
  allBattles,
  loading,
  search,
  setSearch,
  sortBy,
  setSortBy,
  filterMode,
  setFilterMode,
  joinCode,
  setJoinCode,
  onJoinPrivateBattle,
  currentUserId,
  isAdmin,
  onJoinBattle,
  onWatchBattle,
  onCreateBattle,
  onRefresh,
  page,
  setPage,
  totalPages,
}) => {
  const [resolvingCode, setResolvingCode] = useState(false);

  return (
    <>
      {/* Filters */}
      <div className="glass-card p-4 mb-6 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by host..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8ff]/40"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none appearance-none pr-7 cursor-pointer"
            >
              <option value="newest" className="bg-[#141520]">Newest</option>
              <option value="highest" className="bg-[#141520]">Highest Value</option>
              <option value="lowest" className="bg-[#141520]">Lowest Value</option>
              <option value="players" className="bg-[#141520]">Most Players</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Private code..."
              maxLength={6}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9b5cff]/40 w-32"
            />
            <button
              onClick={async () => {
                setResolvingCode(true);
                try {
                  await onJoinPrivateBattle(joinCode.trim().toUpperCase());
                } catch (err: any) {
                  alert(err?.message || 'Invalid code.');
                } finally {
                  setResolvingCode(false);
                }
              }}
              disabled={joinCode.trim().length < 6 || resolvingCode}
              className="px-3 py-2 rounded-xl bg-[#9b5cff]/20 border border-[#9b5cff]/30 text-[#9b5cff] text-xs font-bold hover:bg-[#9b5cff]/30 transition-all disabled:opacity-40"
            >
              {resolvingCode ? <span className="animate-pulse">...</span> : <Shield size={13} />}
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'standard', 'underdog', 'shared'] as FilterMode[]).map(f => (
            <button key={f} onClick={() => setFilterMode(f)}
              className="px-3 py-1 rounded-full text-xs font-bold uppercase transition-all"
              style={{
                background: filterMode === f ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.05)',
                color: filterMode === f ? '#00c8ff' : '#9ca3af',
                border: `1px solid ${filterMode === f ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {f === 'all' ? 'All Modes' : MODE_INFO[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card h-52 animate-pulse rounded-xl" />)}
        </div>
      ) : battles.length === 0 ? (
        <EmptyState onCreateBattle={onCreateBattle} message="No active battles right now." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {battles.map((b, i) => (
              <BattleCard key={b.id} battle={b} index={i} currentUserId={currentUserId} isAdmin={isAdmin}
                onJoin={(teamSide) => onJoinBattle(b.id, teamSide)} onWatch={() => onWatchBattle(b.id)} onRefresh={onRefresh} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-all font-display text-xs uppercase tracking-wider"
          >
            Prev
          </button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg font-display text-xs transition-all ${
                  page === i + 1
                    ? 'bg-[#ffd700] text-black shadow-lg shadow-[#ffd700]/20'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-all font-display text-xs uppercase tracking-wider"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
};
