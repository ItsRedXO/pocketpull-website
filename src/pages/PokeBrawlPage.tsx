import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Swords, Trees, ShoppingBag, Target, BarChart3, Coins, Lock, TrendingUp } from 'lucide-react';
import { getBrawlProfile } from '../lib/brawlApi';
import { useAuth } from '../hooks/useAuth';
import { IntroFlow } from './brawl/IntroFlow';
import { TeamTab } from './brawl/TeamTab';
import { PlayTab } from './brawl/PlayTab';
import { SafariZoneTab } from './brawl/SafariZoneTab';
import { ItemsTab } from './brawl/ItemsTab';
import { ChallengesTab } from './brawl/ChallengesTab';
import { LeaderboardsTab } from './brawl/LeaderboardsTab';
import { DailyBonusButton } from './brawl/DailyBonusButton';

type SubTab = 'team' | 'play' | 'safari' | 'items' | 'challenges' | 'leaderboards';

const SUB_TABS: { id: SubTab; label: string; icon: React.FC<{ size?: number; className?: string }>; disabled?: boolean }[] = [
  { id: 'team', label: 'Team', icon: Users },
  { id: 'play', label: 'Play', icon: Swords },
  { id: 'safari', label: 'Safari Zone', icon: Trees },
  { id: 'items', label: 'Items', icon: ShoppingBag },
  { id: 'challenges', label: 'Challenges', icon: Target },
  { id: 'leaderboards', label: 'Leaderboards', icon: BarChart3 },
];

export function PokeBrawlPage() {
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: profileData, isLoading } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile, enabled: isAuthenticated });
  const [subTab, setSubTab] = useState<SubTab>('team');

  const handleIntroComplete = () => {
    qc.invalidateQueries({ queryKey: ['brawl-profile'] });
    qc.invalidateQueries({ queryKey: ['brawl-roster'] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-h-screen px-3 md:px-5 py-8" style={{ background: '#0a0b0f' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl uppercase tracking-tighter" style={{ textShadow: '0 0 40px rgba(155,92,255,0.6), 0 0 80px rgba(0,200,255,0.2)' }}>
            Poke Brawl
          </h1>
          <p className="text-white/40 text-xs mt-2 uppercase tracking-widest">Build a team. Simulate battles. Climb the ladder.</p>
        </div>

        {!isAuthenticated ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="text-center space-y-4 px-4">
              <Lock size={48} className="mx-auto text-[#00c8ff]/20" />
              <h2 className="text-2xl font-display text-white uppercase tracking-tight">Sign In Required</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto">Log in to build your team and start battling in Poke Brawl.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="text-white/40 text-sm py-24 text-center">Loading Poke Brawl…</div>
        ) : !profileData?.profile.has_completed_intro ? (
          <IntroFlow onComplete={handleIntroComplete} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1" role="tablist">
                {SUB_TABS.map(t => (
                  <button key={t.id} disabled={t.disabled} onClick={() => !t.disabled && setSubTab(t.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap rounded-lg ${
                      t.disabled ? 'text-white/20 cursor-default' : subTab === t.id ? 'text-black' : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}>
                    {!t.disabled && subTab === t.id && (
                      <motion.span layoutId="brawl-subtab-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#9b5cff] to-[#00c8ff]"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <span className="relative flex items-center gap-1.5"><t.icon size={13} /> {t.label}</span>
                    {t.disabled && <span className="relative ml-1 text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 normal-case tracking-normal">Coming Soon</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DailyBonusButton dailyBonus={profileData?.dailyBonus} />
                {profileData?.rank && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#9b5cff]/10 border border-[#9b5cff]/25 text-[#9b5cff] text-xs font-bold">
                    <TrendingUp size={13} /> Global Rank: {profileData.rank.rank} of {profileData.rank.total}
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#facc15]/10 border border-[#facc15]/25 text-[#facc15] text-xs font-bold">
                  <Coins size={13} /> {(profileData?.balance ?? 0).toLocaleString()}
                </motion.div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#9b5cff]/50 to-transparent" />
              <AnimatePresence mode="wait">
                <motion.div key={subTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                  {subTab === 'team' && <TeamTab />}
                  {subTab === 'play' && <PlayTab />}
                  {subTab === 'safari' && <SafariZoneTab />}
                  {subTab === 'items' && <ItemsTab />}
                  {subTab === 'challenges' && <ChallengesTab />}
                  {subTab === 'leaderboards' && <LeaderboardsTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
