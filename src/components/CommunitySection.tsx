import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { startOfDay } from 'date-fns';
import { blink } from '../lib/blink';
import { useLiveCounters } from '../hooks/useLiveCounters';
import { useGodPulls } from '../hooks/usePacks';

const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra: 'Ultra Rare',
  secret: 'Secret Rare',
  god: 'GOD PULL',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: 'Waiting', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)' },
  live: { label: 'In Progress', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  finished: { label: 'Completed', color: '#9b5cff', bg: 'rgba(155,92,255,0.1)' },
  canceled: { label: 'Canceled', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

export const CommunitySection: React.FC = () => {
  const { cardsWonToday, liveBattles, totalUpgrades, exchangesToday, avgPullValue } = useLiveCounters();
  const { data: godPulls = [], isLoading: loadingGodPulls, isError: godPullsError, refetch: refetchGodPulls } = useGodPulls();

  // Rotation logic for God Pulls
  const [rotationIdx, setRotationIdx] = useState(0);
  useEffect(() => {
    if (godPulls.length <= 6) return;
    const id = setInterval(() => {
      setRotationIdx(prev => (prev + 3) % godPulls.length);
    }, 8000);
    return () => clearInterval(id);
  }, [godPulls.length]);

  const displayedGodPulls = useMemo(() => {
    if (godPulls.length === 0) return [];
    if (godPulls.length <= 6) return godPulls;
    // Show a slice of 6 cards starting from rotationIdx
    const slice = [];
    for (let i = 0; i < 6; i++) {
      slice.push(godPulls[(rotationIdx + i) % godPulls.length]);
    }
    return slice;
  }, [godPulls, rotationIdx]);

  // ── Real Battle Results ──
  const { data: realRecentBattles = [] } = useQuery({
    queryKey: ['community-recent-battles'],
    queryFn: async () => {
      const battles = await blink.db.battles.list({
        orderBy: { createdAt: 'desc' },
        limit: 5
      }) as any[];

      if (!battles || battles.length === 0) return [];

      // Fetch players for these battles to show who's involved (including bots)
      const battlesWithPlayers = await Promise.all(
        battles.map(async (battle) => {
          const players = await blink.db.battlePlayers.list({
            where: { battleId: battle.id }
          }) as any[];
          
          return {
            ...battle,
            players: players.map(p => ({
              username: p.username,
              isAi: Number(p.isAi) > 0,
              isWinner: Number(p.isWinner) > 0
            }))
          };
        })
      );

      return battlesWithPlayers;
    },
    refetchInterval: 5000,
  });

  const stats = [
    { label: 'Cards Pulled Today', value: cardsWonToday.toLocaleString(), icon: '✨', color: '#9b5cff' },
    { label: 'Active Battles', value: liveBattles.toLocaleString(), icon: '⚔️', color: '#ef4444' },
    { label: 'Total Upgrades', value: totalUpgrades.toLocaleString(), icon: '⬆️', color: '#10b981' },
    { label: 'Exchanges Today', value: exchangesToday.toLocaleString(), icon: '🔄', color: '#00c8ff' },
    { label: 'Avg Pull Value', value: `$${avgPullValue.toFixed(0)}`, icon: '💰', color: '#ffd700' },
  ];

  return (
    <section className="py-16 bg-[#060710]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-16">

        {/* ── Community Stats ── */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white">
              📊 PLATFORM ACTIVITY
            </h2>
            <div className="w-12 h-0.5 bg-[#00c8ff] mt-2" style={{ boxShadow: '0 0 8px #00c8ff' }} />
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card p-4 text-center hover:scale-105 transition-transform duration-200 cursor-default"
                style={{ borderColor: `${stat.color}30` }}
              >
                <div className="text-2xl mb-2">{stat.icon}</div>
                <p
                  className="font-display text-lg leading-tight"
                  style={{ color: stat.color, textShadow: `0 0 10px ${stat.color}66` }}
                >
                  {stat.value}
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Two column: Battle Results + Featured Cards (God Pulls) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Recent Battle Results */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <h2 className="font-display text-xl md:text-2xl uppercase tracking-wider text-white flex items-center gap-3">
                <span>⚔️ RECENT BATTLES</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              </h2>
              <div className="w-12 h-0.5 bg-[#ef4444] mt-2" />
            </motion.div>

            <div className="space-y-3">
              {realRecentBattles.length > 0 ? realRecentBattles.map((battle: any, i: number) => {
                const statusInfo = STATUS_CONFIG[battle.status] || { label: battle.status, color: '#fff', bg: 'rgba(255,255,255,0.1)' };
                const packs = JSON.parse(battle.packsJson || '[]');
                const packNames = packs.map((p: any) => p.name).join(', ');
                const winner = battle.players?.find((p: any) => p.isWinner);
                
                return (
                  <motion.div
                    key={battle.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-4 flex flex-col gap-3 hover:border-white/15 transition-all duration-200"
                  >
                    {/* Top Row: Mode + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#ffd700]">
                          {battle.mode === 'shared' ? '🤝 Shared' : '⚔️ Standard'}
                        </span>
                        <span className="text-[10px] text-gray-700">•</span>
                        <span 
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/5"
                          style={{ color: statusInfo.color, background: statusInfo.bg }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-700 font-display">
                        {battle.endedAt || battle.startedAt || battle.createdAt 
                          ? new Date(battle.endedAt || battle.startedAt || battle.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : 'Recently'}
                      </span>
                    </div>

                    {/* Middle: Players + VS */}
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2 overflow-hidden">
                        {battle.players?.map((p: any, idx: number) => (
                          <div 
                            key={idx}
                            className="w-7 h-7 rounded-full border-2 border-[#0d0e1a] flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative"
                            style={{ background: p.isAi ? '#9b5cff' : `hsl(${idx * 137.5}deg, 50%, 50%)` }}
                            title={p.username}
                          >
                            {p.username.charAt(0).toUpperCase()}
                            {p.isWinner && (
                              <div className="absolute -top-1 -right-1 text-[8px]">👑</div>
                            )}
                          </div>
                        ))}
                        {battle.players?.length < (battle.playerCount || 2) && (
                          <div className="w-7 h-7 rounded-full border-2 border-[#0d0e1a] bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                            ?
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/60 truncate">
                          {battle.players?.map((p: any) => p.username).join(', ')}
                          {battle.players?.length < (battle.playerCount || 2) && '...'}
                        </p>
                        {winner && (
                          <p className="text-[10px] text-[#ffd700] font-bold">
                            Winner: {winner.username}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Packs + Cost */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] text-gray-600 uppercase tracking-widest shrink-0">Packs:</span>
                        <span className="text-[10px] text-white/40 truncate" title={packNames}>
                          {packNames}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-gray-600 uppercase tracking-widest mr-2">Entry:</span>
                        <span className="text-[11px] font-bold text-[#10b981]">${Number(battle.totalCost).toFixed(2)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="py-12 text-center text-gray-600 uppercase tracking-widest text-xs border border-white/5 rounded-xl bg-white/[0.02]">
                  No recent battles found
                </div>
              )}
            </div>

            {/* Open battles CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-4 glass-card p-4 border-dashed border-white/10 text-center"
            >
              <p className="text-sm text-gray-500">
                <span className="text-[#00c8ff] font-display">{liveBattles.toLocaleString()} active battles</span> waiting for challengers
              </p>
            </motion.div>
          </div>

          {/* Featured Cards (God Pulls) */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <h2 className="font-display text-xl md:text-2xl uppercase tracking-wider text-white flex items-center justify-between">
                <span>🔥 GOD PULLS</span>
                <span className="text-[10px] text-white/30 font-normal tracking-widest">REAL CATALOG DATA</span>
              </h2>
              <div className="w-12 h-0.5 bg-[#ff00ff] mt-2" style={{ boxShadow: '0 0 8px #ff00ff' }} />
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-[360px]">
              {loadingGodPulls ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 bg-white/5 rounded-xl animate-pulse" />
                ))
              ) : displayedGodPulls.length > 0 ? displayedGodPulls.map((card: any, i: number) => (
                <motion.div
                  key={`${card.id}-${rotationIdx}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 text-center"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${card.glow}35`,
                    boxShadow: `0 0 20px -8px ${card.glow}55`,
                  }}
                >
                  {/* Rarity glow blob */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{ background: `radial-gradient(ellipse at center, ${card.glow} 0%, transparent 70%)` }}
                  />

                  <div className="h-20 w-full flex items-center justify-center relative z-10 mb-1">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="text-4xl">💎</div>
                    )}
                  </div>
                  
                  <div className="min-h-[44px] flex flex-col items-center justify-center">
                    <p className="font-display text-[10px] text-white leading-tight relative z-10 line-clamp-2">{card.name}</p>
                    <p className="text-[8px] text-[#00c8ff] font-bold uppercase mt-1 truncate w-full">{card.packName}</p>
                  </div>

                  <span
                    className="text-[8px] font-bold uppercase tracking-wider relative z-10"
                    style={{ color: card.glow }}
                  >
                    {RARITY_LABEL[card.rarity] || card.rarity}
                  </span>
                  <p
                    className="font-display text-base relative z-10"
                    style={{ color: card.glow, textShadow: `0 0 8px ${card.glow}99` }}
                  >
                    ${card.value.toLocaleString()}
                  </p>
                </motion.div>
              )) : (
                <div className="col-span-full py-20 text-center text-gray-600 uppercase tracking-widest text-xs border border-white/5 rounded-xl bg-white/[0.02]">
                  No God Pulls in catalog
                </div>
              )}
            </div>

            {/* Rotation note */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5"
            >
              <span className="text-[#ff00ff] text-sm animate-pulse">✨</span>
              <p className="text-xs text-gray-600">
                <span className="text-gray-400">Discover ultra-rare</span> God Pulls from our <span className="text-[#00c8ff]">premium packs</span>. Odds are verified and fair.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};