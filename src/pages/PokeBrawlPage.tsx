import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Swords, Binoculars, Briefcase, Sparkles, Trophy, BarChart3, Coins, Lock, TrendingUp, ChevronsRight } from 'lucide-react';
import { getBrawlProfile, getBrawlRoster } from '../lib/brawlApi';
import { useAuth } from '../hooks/useAuth';
import { IntroFlow } from './brawl/IntroFlow';
import { TeamTab } from './brawl/TeamTab';
import { PlayTab } from './brawl/PlayTab';
import { SafariZoneTab } from './brawl/SafariZoneTab';
import { ItemsTab } from './brawl/ItemsTab';
import { EvolveUpgradeTab } from './brawl/EvolveUpgradeTab';
import { ChallengesTab } from './brawl/ChallengesTab';
import { LeaderboardsTab } from './brawl/LeaderboardsTab';
import { DailyBonusButton } from './brawl/DailyBonusButton';
import { typeColor } from './brawl/typeColors';

type SubTab = 'team' | 'play' | 'safari' | 'items' | 'evolve' | 'challenges' | 'leaderboards';

const SUB_TABS: { id: SubTab; label: string; icon: React.FC<{ size?: number; className?: string }>; disabled?: boolean }[] = [
  { id: 'team', label: 'Team', icon: Users },
  { id: 'play', label: 'Play', icon: Swords },
  { id: 'safari', label: 'Safari Zone', icon: Binoculars },
  { id: 'items', label: 'Items', icon: Briefcase },
  { id: 'evolve', label: 'Evolve & Upgrade', icon: Sparkles },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'leaderboards', label: 'Leaderboards', icon: BarChart3 },
];

export function PokeBrawlPage() {
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: profileData, isLoading } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile, enabled: isAuthenticated });
  const { data: rosterData } = useQuery({ queryKey: ['brawl-roster'], queryFn: getBrawlRoster, enabled: isAuthenticated });
  const [subTab, setSubTab] = useState<SubTab>('team');

  const activeTeam = useMemo(() => (rosterData?.roster || []).filter(m => Number(m.is_on_team)), [rosterData]);
  const teamPower = useMemo(() => activeTeam.reduce((sum, m) => sum + m.overall_rating, 0), [activeTeam]);
  const typeSynergy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of activeTeam) counts.set(m.primary_type, (counts.get(m.primary_type) || 0) + 1);
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, multiplier: (1 + 0.05 * (count - 1)).toFixed(2) }))
      .sort((a, b) => b.multiplier.localeCompare(a.multiplier))
      .slice(0, 4);
  }, [activeTeam]);

  const handleIntroComplete = () => {
    qc.invalidateQueries({ queryKey: ['brawl-profile'] });
    qc.invalidateQueries({ queryKey: ['brawl-roster'] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-h-screen px-3 md:px-5 py-8" style={{ background: '#0a0b0f' }}>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full shrink-0 relative overflow-hidden border-[3px] border-[#1a1d24]" style={{ background: 'linear-gradient(#e0304a 0%, #e0304a 48%, #1a1d24 48%, #1a1d24 52%, #f4f4f4 52%, #f4f4f4 100%)', boxShadow: '0 0 20px rgba(155,92,255,0.5)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white border-2 border-[#1a1d24]" />
              </div>
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-5xl uppercase tracking-tighter leading-none" style={{ textShadow: '0 0 40px rgba(155,92,255,0.6), 0 0 80px rgba(0,200,255,0.2)' }}>
                Poke Brawl
              </h1>
              <p className="text-white/40 text-[10px] md:text-xs mt-1.5 uppercase tracking-widest">Build a team. Simulate battles. Climb the ladder.</p>
            </div>
          </div>

          {isAuthenticated && profileData?.profile.has_completed_intro && (
            <div className="flex items-center gap-4 md:gap-6 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Swords size={22} className="text-[#9b5cff]" />
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40 leading-none">Team Power</div>
                  <div className="text-xl font-black text-white leading-tight">{teamPower}</div>
                </div>
              </div>

              {typeSynergy.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Type Synergy</div>
                  <div className="flex flex-col gap-0.5">
                    {typeSynergy.map(t => (
                      <div key={t.type} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor(t.type) }} />
                        <span className="text-white/60 capitalize w-14">{t.type}</span>
                        <span className="text-[#4ade80] font-bold">x{t.multiplier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={() => setSubTab('play')}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black shadow-[0_0_20px_rgba(0,200,255,0.4)] shrink-0">
                <Swords size={15} /> Battle Now <ChevronsRight size={16} />
              </motion.button>
            </div>
          )}
        </div>

        {isAuthenticated && profileData?.profile.has_completed_intro && (
          <div className="flex items-center justify-end gap-2 flex-wrap mb-4">
            <DailyBonusButton dailyBonus={profileData?.dailyBonus} />
            {profileData?.rank && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#9b5cff]/10 border border-[#9b5cff]/25 text-[#9b5cff] text-xs font-bold whitespace-nowrap">
                <TrendingUp size={13} /> Rank {profileData.rank.rank} <span className="hidden sm:inline">of {profileData.rank.total}</span>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#facc15]/10 border border-[#facc15]/25 text-[#facc15] text-xs font-bold whitespace-nowrap">
              <Coins size={13} /> {(profileData?.balance ?? 0).toLocaleString()}
            </motion.div>
          </div>
        )}

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
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex lg:flex-col gap-2 w-full lg:w-48 shrink-0 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0" role="tablist">
              {SUB_TABS.map(t => (
                <button key={t.id} disabled={t.disabled} onClick={() => !t.disabled && setSubTab(t.id)}
                  className={`relative flex flex-row lg:flex-col items-center justify-start lg:justify-center gap-2 lg:gap-1.5 px-3 py-2.5 lg:py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap rounded-xl shrink-0 w-full ${
                    t.disabled ? 'text-white/20 cursor-default' : subTab === t.id ? 'text-black' : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}>
                  {!t.disabled && subTab === t.id && (
                    <motion.span layoutId="brawl-subtab-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                  )}
                  <span className="relative shrink-0"><t.icon size={18} /></span>
                  <span className="relative text-center leading-tight">{t.label}</span>
                  {t.disabled && <span className="relative lg:mt-0.5 text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 normal-case tracking-normal">Coming Soon</span>}
                </button>
              ))}
            </div>

            <div className="flex-1 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#9b5cff]/50 to-transparent" />
              <AnimatePresence mode="wait">
                <motion.div key={subTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                  {subTab === 'team' && <TeamTab />}
                  {subTab === 'play' && <PlayTab />}
                  {subTab === 'safari' && <SafariZoneTab />}
                  {subTab === 'items' && <ItemsTab />}
                  {subTab === 'evolve' && <EvolveUpgradeTab />}
                  {subTab === 'challenges' && <ChallengesTab />}
                  {subTab === 'leaderboards' && <LeaderboardsTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
