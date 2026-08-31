import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Package, ArrowUp } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';

const TABS = [
  { id: 'pulls',    label: 'Biggest Pulls',      icon: <Trophy size={13} /> },
  { id: 'packs',    label: 'Most Packs',          icon: <Package size={13} /> },
  { id: 'upgrades', label: 'Upgrades Attempted',  icon: <ArrowUp size={13} /> },
];

// Podium order: index 0 = 2nd (left), index 1 = 1st (center), index 2 = 3rd (right)
const PODIUM_ORDER = [1, 0, 2]; // map to data indices

const PODIUM_STYLES = [
  // 2nd place (left)
  { borderColor: '#c0c0c0', bg: 'rgba(192,192,192,0.07)', glow: '0 0 28px -8px rgba(192,192,192,0.4)', crown: '🥈', valueColor: '#c0c0c0', height: 'h-[220px]', label: '2nd' },
  // 1st place (center — tallest)
  { borderColor: '#ffd700', bg: 'rgba(255,215,0,0.08)',   glow: '0 0 40px -8px rgba(255,215,0,0.55)',  crown: '👑', valueColor: '#ffd700', height: 'h-[260px]', label: '1st' },
  // 3rd place (right)
  { borderColor: '#cd7f32', bg: 'rgba(205,127,50,0.07)',  glow: '0 0 24px -8px rgba(205,127,50,0.35)', crown: '🥉', valueColor: '#cd7f32', height: 'h-[200px]', label: '3rd' },
];

export const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pulls');
  const [page, setPage] = useState(1);
  const { pulls, packs, upgrades, isLoading } = useLeaderboard();

  let allData: any[] = [];
  if (activeTab === 'pulls') allData = pulls;
  else if (activeTab === 'packs') allData = packs;
  else if (activeTab === 'upgrades') allData = upgrades;

  const pageSize = 50;
  const startIndex = (page - 1) * pageSize;
  const data = allData.slice(startIndex, startIndex + pageSize);

  const topThree = page === 1 ? data.slice(0, 3) : [];
  const rest = page === 1 ? data.slice(3) : data;

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setPage(1);
  };

  return (
    <section className="py-16 px-4 md:px-6" style={{ backgroundColor: '#0a0b0f' }}>
      <div className="max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white"
          >
            🏆 Leaderboard
          </motion.h2>
          <div className="mx-auto mt-1 h-[2px] w-24 rounded-full" style={{ background: 'linear-gradient(90deg, #ffd700, #ff9900)' }} />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-display text-[12px] uppercase tracking-wider transition-all duration-200"
              style={{
                background: activeTab === tab.id ? '#ffd700' : 'rgba(255,255,255,0.04)',
                color: activeTab === tab.id ? '#000' : 'rgba(255,255,255,0.55)',
                border: `1px solid ${activeTab === tab.id ? '#ffd700' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: activeTab === tab.id ? '0 0 16px -4px rgba(255,215,0,0.5)' : 'none',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-10 h-10 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mb-4" />
              <p className="text-white/40 font-display uppercase tracking-widest text-sm">Loading stats...</p>
            </motion.div>
          ) : allData.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 rounded-2xl border border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <p className="text-white/40 font-display uppercase tracking-widest text-lg mb-2">No data yet</p>
              <p className="text-white/20 text-sm">Be the first player on the leaderboard!</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeTab}-${page}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              {/* Podium - only on page 1 */}
              {page === 1 && topThree.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6 items-end">
                  {PODIUM_ORDER.map((dataIdx, podiumIdx) => {
                    const player = topThree[dataIdx];
                    if (!player) return <div key={podiumIdx} />;
                    const style = PODIUM_STYLES[podiumIdx];
                    return (
                      <motion.div
                        key={player.user}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: podiumIdx * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={`relative flex flex-col items-center justify-end ${style.height} rounded-2xl px-3 py-4 overflow-hidden text-center`}
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.borderColor}44`,
                          boxShadow: style.glow,
                        }}
                      >
                        {/* Background glow blob */}
                        <div
                          className="absolute top-0 left-0 right-0 h-28 pointer-events-none"
                          style={{ background: `radial-gradient(ellipse at 50% 0%, ${style.borderColor}18, transparent 70%)` }}
                        />

                        {/* Crown */}
                        <div className="text-2xl mb-1 z-10">{style.crown}</div>

                        {/* Avatar emoji */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 z-10"
                          style={{ background: style.borderColor + '18', border: `1px solid ${style.borderColor}44` }}
                        >
                          {player.avatar}
                        </div>

                        <p className="font-display text-[13px] text-white leading-tight z-10 truncate w-full">{player.user}</p>
                        <p className="text-[10px] text-white/30 truncate w-full z-10 mt-0.5">{player.sub}</p>
                        <p
                          className="font-display text-xl mt-1 z-10"
                          style={{ color: style.valueColor, textShadow: `0 0 10px ${style.borderColor}77` }}
                        >
                          {player.value}
                        </p>

                        {/* Rank label badge */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl"
                          style={{ background: style.borderColor }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ── List Rows ───────────────────────────────────────────────── */}
              <div className="space-y-2">
                {rest.map((player, i) => (
                  <motion.div
                    key={player.user + i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/[0.04] group"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span className="font-display text-xl text-white/30 w-7 text-center flex-shrink-0">{player.rank}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {player.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white/90 group-hover:text-[#00c8ff] transition-colors">{player.user}</p>
                      <p className="text-[10px] text-white/30 truncate">{player.sub}</p>
                    </div>
                    <p className="font-display text-base flex-shrink-0" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
                      {player.value}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Pagination Controls */}
              <div className="flex justify-center gap-3 mt-10">
                <button
                  onClick={() => setPage(1)}
                  className={`px-6 py-2 rounded-xl font-display text-[12px] uppercase tracking-wider transition-all duration-200 ${
                    page === 1 ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/40 border-white/5 hover:text-white/60'
                  }`}
                  style={{ border: '1px solid' }}
                >
                  Page 1
                </button>
                <button
                  onClick={() => setPage(2)}
                  className={`px-6 py-2 rounded-xl font-display text-[12px] uppercase tracking-wider transition-all duration-200 ${
                    page === 2 ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/40 border-white/5 hover:text-white/60'
                  }`}
                  style={{ border: '1px solid' }}
                >
                  Page 2
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom notice ─────────────────────────────────────────────── */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-white/25 uppercase tracking-widest font-display">
            🏅 Top 100 players earn monthly rewards — Keep climbing
          </p>
        </div>

      </div>
    </section>
  );
};