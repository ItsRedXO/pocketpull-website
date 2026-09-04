import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { blink } from '../../lib/blink';
import { useAuth, useUserStats } from '../../hooks/useAuth';
import { useLiveCounters } from '../../hooks/useLiveCounters';
import { useSimulatedBattles } from '../../hooks/useSimulatedBattles';
import type { BattleWithPlayers } from './battleTypes';
import { resolvePrivateBattleCode } from '../../lib/api';

// Sub-components
import { StatCards } from './board/StatCards';
import { LiveTab } from './board/LiveTab';
import { MyBattlesTab } from './board/MyBattlesTab';
import { DailyTab } from './board/DailyTab';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabView = 'live' | 'mine' | 'daily';
type SortOption = 'newest' | 'highest' | 'lowest' | 'players';
type FilterMode = 'all' | 'standard' | 'underdog' | 'shared';

interface Props {
  onCreateBattle: () => void;
  onJoinBattle: (battleId: string, teamSide?: 'left' | 'right') => void | Promise<void>;
  onWatchBattle: (battleId: string) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const LiveBattleBoard: React.FC<Props> = ({ onCreateBattle, onJoinBattle, onWatchBattle }) => {
  const { user } = useAuth();
  const { stats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const isAdmin = stats?.role === 'admin';
  const { liveBattles: realLiveCount } = useLiveCounters();
  const simBattles = useSimulatedBattles();
  const liveCount = realLiveCount + simBattles.length;
  const [activeTab, setActiveTab] = useState<TabView>('live');

  // 1. Fetch Board Data (Optimized backend route)
  const { data: lobbyData, isLoading: loading, refetch } = useQuery({
    queryKey: ['battle-lobby', user?.id],
    queryFn: async () => {
      const url = new URL('https://b2nnhe2n.backend.blink.new/battles/lobby');
      if (user?.id) url.searchParams.append('userId', user.id);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch board data');
      return res.json() as Promise<{
        live: BattleWithPlayers[];
        daily: BattleWithPlayers[];
        mine: BattleWithPlayers[];
      }>;
    },
    refetchInterval: 15000, // Realtime is primary; polling remains the fallback.
    staleTime: 5000,
  });

  // Board data is refreshed by the authoritative polling query below. Avoid opening
  // a separate realtime socket here; a failed socket was surfacing as an unhandled
  // WebSocket console error while the polling path continued to work.

  const dbLiveBattles = lobbyData?.live || [];
  const myBattles = lobbyData?.mine || [];
  const dailyBattles = lobbyData?.daily || [];

  // Live tab filters
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [joinCode, setJoinCode] = useState('');

  const handlePrivateCodeJoin = async (code: string) => {
    const result = await resolvePrivateBattleCode(code);
    onJoinBattle(result.battleId);
  };

  // Daily top battle (highest cost today)
  const dailyTopBattle = useMemo(() => {
    if (dailyBattles.length === 0) return null;
    return [...dailyBattles].sort((a, b) => (b.totalCost * b.playerCount) - (a.totalCost * a.playerCount))[0];
  }, [dailyBattles]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Combine real + simulated for the live tab
  const liveBattles = useMemo(() => {
    // Real battles first, then simulated
    return [...dbLiveBattles, ...simBattles];
  }, [dbLiveBattles, simBattles]);

  // ── Stats for tab buttons ──────────────────────────────────────────────────
  const myCount = myBattles.length;
  const dailyTopValue = dailyTopBattle
    ? dailyTopBattle.totalCost * dailyTopBattle.playerCount
    : null;

  // ── Filtered live list ─────────────────────────────────────────────────────
  const filteredLive = liveBattles
    .filter(b => {
      if (filterMode !== 'all' && b.mode !== filterMode) return false;
      if (search && !b.hostUsername.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      // Always prioritize real battles over simulated
      if (!!a.isSimulated !== !!b.isSimulated) {
        return a.isSimulated ? 1 : -1;
      }
      
      if (sortBy === 'highest') return b.totalCost - a.totalCost;
      if (sortBy === 'lowest') return a.totalCost - b.totalCost;
      if (sortBy === 'players') return b.players.length - a.players.length;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalPages = Math.ceil(filteredLive.length / pageSize);
  const pagedBattles = filteredLive.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-[#0a0b0f] px-4 py-10">
      <div className="max-w-6xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <h1
              className="font-display text-5xl md:text-6xl uppercase tracking-tighter"
              style={{ textShadow: '0 0 40px rgba(255,215,0,0.4)' }}
            >
              PACK <span className="text-[#ffd700]">BATTLES</span>
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Open together. Winner takes all.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onCreateBattle}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-display text-base uppercase text-black shimmer-btn"
            style={{ background: 'linear-gradient(135deg,#ffd700,#e6a800)', boxShadow: '0 0 25px -5px rgba(255,215,0,0.6)' }}
          >
            <Plus size={16} /> CREATE BATTLE
          </motion.button>
        </div>

        {/* ── Tab stat cards ───────────────────────────────────────────────── */}
        <StatCards
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          myCount={myCount}
          liveCount={liveCount}
          dailyTopValue={dailyTopValue}
          dailyTopBattle={dailyTopBattle}
          onWatchBattle={onWatchBattle}
        />

        {/* ── Board content (animated swap) ───────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'live' && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              <LiveTab
                battles={pagedBattles}
                allBattles={liveBattles}
                loading={loading}
                search={search} setSearch={(v) => { setSearch(v); setPage(1); }}
                sortBy={sortBy} setSortBy={(v) => { setSortBy(v); setPage(1); }}
                filterMode={filterMode} setFilterMode={(v) => { setFilterMode(v); setPage(1); }}
                joinCode={joinCode} setJoinCode={setJoinCode}
                onJoinPrivateBattle={handlePrivateCodeJoin}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onJoinBattle={onJoinBattle}
                onWatchBattle={onWatchBattle}
                onCreateBattle={onCreateBattle}
                onRefresh={() => refetch()}
                page={page}
                setPage={setPage}
                totalPages={totalPages}
              />
            </motion.div>
          )}

          {activeTab === 'mine' && (
            <motion.div
              key="mine"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              <MyBattlesTab
                battles={myBattles}
                loading={loading}
                currentUserId={user?.id}
                onWatch={onWatchBattle}
                onRejoin={onJoinBattle}
              />
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              <DailyTab
                battles={dailyBattles}
                loading={loading}
                onWatch={onWatchBattle}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
