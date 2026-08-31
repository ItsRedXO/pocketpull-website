import React from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Play } from 'lucide-react';
import { BattleWithPlayers } from '../battleTypes';

interface StatCardsProps {
  activeTab: 'live' | 'mine' | 'daily';
  setActiveTab: (tab: 'live' | 'mine' | 'daily') => void;
  myCount: number;
  liveCount: number;
  dailyTopValue: number | null;
  dailyTopBattle: BattleWithPlayers | null;
  onWatchBattle: (id: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  activeTab,
  setActiveTab,
  myCount,
  liveCount,
  dailyTopValue,
  dailyTopBattle,
  onWatchBattle,
}) => {
  const tabs = React.useMemo(() => [
    {
      id: 'mine' as const,
      icon: <Swords size={15} />,
      label: 'My Battles',
      value: String(myCount),
      color: '#00c8ff',
    },
    {
      id: 'live' as const,
      icon: (
        <motion.span
          animate={{ scale: [1, 1.35, 1], opacity: [1, 0.45, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="w-3 h-3 rounded-full bg-green-400 inline-block"
        />
      ),
      label: 'Live Now',
      value: String(liveCount),
      color: '#10b981',
    },
    {
      id: 'daily' as const,
      icon: <Trophy size={15} />,
      label: 'Daily Top Battle',
      value: dailyTopValue !== null ? `${dailyTopValue.toFixed(2)}` : '—',
      color: '#ffd700',
      sub: dailyTopBattle ? (
        <motion.span
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onWatchBattle(dailyTopBattle.id); } }}
          onClick={e => { e.stopPropagation(); onWatchBattle(dailyTopBattle.id); }}
          className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border transition-all cursor-pointer"
          style={{
            background: 'rgba(255,215,0,0.1)',
            borderColor: 'rgba(255,215,0,0.3)',
            color: '#ffd700',
          }}
        >
          <Play size={9} /> Watch Replay
        </motion.span>
      ) : null,
    },
  ], [myCount, liveCount, dailyTopValue, dailyTopBattle, onWatchBattle]);

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="glass-card p-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left cursor-pointer relative overflow-hidden transition-all"
            style={{
              borderColor: isActive ? `${tab.color}55` : 'rgba(255,255,255,0.07)',
              boxShadow: isActive
                ? `0 0 24px -6px ${tab.color}66, inset 0 0 30px -15px ${tab.color}22`
                : '0 0 0px transparent',
              background: isActive
                ? `linear-gradient(135deg, ${tab.color}0e, rgba(255,255,255,0.03))`
                : undefined,
            }}
          >
            {/* Active glow strip */}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute left-0 top-0 w-0.5 h-full rounded-l-xl"
                style={{ background: tab.color }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}

            {/* Subtle shimmer on active */}
            {isActive && (
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-xl"
                animate={{ opacity: [0, 0.06, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                style={{ background: `radial-gradient(ellipse at 30% 50%, ${tab.color}, transparent 70%)` }}
              />
            )}

            <span style={{ color: isActive ? tab.color : `${tab.color}88` }} className="relative z-10 transition-colors duration-200">
              {tab.icon}
            </span>

            <div className="relative z-10 flex flex-col items-center sm:items-start">
              <p
                className="font-display text-xl leading-tight transition-all duration-200"
                style={{ color: tab.color, textShadow: isActive ? `0 0 16px ${tab.color}88` : 'none' }}
              >
                {tab.value}
              </p>
              <p className="text-[11px] uppercase tracking-wider transition-colors duration-200"
                style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(156,163,175,0.7)' }}>
                {tab.label}
              </p>
              {tab.sub}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
