import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Clock, Coins, Trophy, Swords } from 'lucide-react';
import { getBrawlConfig, getBrawlProfile, playBrawlBattle, type BrawlBattlePlayResult } from '../../lib/brawlApi';
import { BattleReplay } from './BattleReplay';

const TIER_COLORS = ['#8892a4', '#6890f0', '#9b5cff', '#f97316', '#facc15'];

function useCooldownLabel(cooldownEndsAt: string | null) {
  const [, setTick] = useState(0);
  React.useEffect(() => { if (!cooldownEndsAt) return; const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, [cooldownEndsAt]);
  if (!cooldownEndsAt) return null;
  const remainingMs = new Date(cooldownEndsAt).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const mins = Math.floor(remainingMs / 60000), secs = Math.floor((remainingMs % 60000) / 1000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m ${secs}s`;
}

function TierRow({ index, color, config, status, onPlay, playing }: { index: number; color: string; config: any; status: { unlocked: boolean; cooldownEndsAt: string | null } | undefined; onPlay: () => void; playing: boolean }) {
  const cooldownLabel = useCooldownLabel(status?.cooldownEndsAt || null);
  const locked = !status?.unlocked;
  const onCooldown = !!cooldownLabel;
  const disabled = locked || onCooldown || playing;

  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="relative flex gap-4">
      <div className="relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-display text-base font-black"
        style={{
          background: locked ? `${color}22` : color,
          border: `2px solid ${locked ? `${color}80` : color}`,
          color: locked ? color : '#fff',
          boxShadow: locked ? 'none' : `0 0 14px ${color}90`,
        }}>
        {locked ? <Lock size={15} /> : index}
      </div>

      <motion.div whileHover={!locked ? { y: -2 } : undefined}
        className="flex-1 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5"
        style={{ borderColor: locked ? 'rgba(255,255,255,0.06)' : `${color}35`, background: locked ? 'rgba(255,255,255,0.015)' : `linear-gradient(120deg, ${color}12 0%, rgba(255,255,255,0.02) 70%)`, opacity: locked ? 0.65 : 1 }}>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm uppercase tracking-wider text-white">{config.label}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50 mt-1">
            <span>{config.matches} match{config.matches > 1 ? 'es' : ''}</span>
            <span>Entry: {config.entryCost > 0 ? `${config.entryCost} pokedollars` : 'Free'}</span>
            {config.cooldownMs > 0 && <span>Cooldown: {config.cooldownMs >= 3600000 ? `${config.cooldownMs / 3600000}h` : `${config.cooldownMs / 60000}m`}</span>}
          </div>
          {locked && config.unlockAfter ? (
            <p className="text-[10px] text-white/30 mt-1">Unlocks after {config.unlockAfter.count} {config.unlockAfter.counter.replace(/_/g, ' ')}</p>
          ) : (
            <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold mt-1.5">
              <Coins size={13} />
              Prize: {config.totalReward ?? config.winReward} pokedollars
            </div>
          )}
        </div>
        <motion.button onClick={onPlay} disabled={disabled} whileHover={!disabled ? { scale: 1.04 } : undefined} whileTap={!disabled ? { scale: 0.96 } : undefined}
          className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          style={disabled ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' } : { background: `linear-gradient(90deg, ${color}, #00c8ff)`, color: '#000' }}>
          {onCooldown ? <><Clock size={13} /> {cooldownLabel}</> : <><Swords size={13} /> Battle</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export function PlayTab() {
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['brawl-config'], queryFn: getBrawlConfig, staleTime: 60_000 });
  const { data: profile } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile });
  const [playingTier, setPlayingTier] = useState<string | null>(null);
  const [result, setResult] = useState<BrawlBattlePlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlay = async (tierId: string) => {
    setError(null);
    setPlayingTier(tierId);
    try {
      const res = await playBrawlBattle(tierId);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Battle failed to start');
      setPlayingTier(null);
    }
  };

  const handleCloseReplay = () => {
    setResult(null);
    setPlayingTier(null);
    qc.invalidateQueries({ queryKey: ['brawl-profile'] });
    qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
  };

  if (!config || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading tiers…</div>;

  const order = ['local_battle', 'local_tournament', 'state_tournament', 'regional_tournament', 'elite_four'];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Battle Tiers</h3>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="relative">
        <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: 'linear-gradient(180deg, rgba(136,146,164,0.3), rgba(250,204,21,0.3))' }} />
        <div className="space-y-3">
          {order.map((id, i) => (
            <TierRow key={id} index={i + 1} color={TIER_COLORS[i]} config={config.battleTiers[id]} status={profile.tierStatus[id]} playing={playingTier === id} onPlay={() => handlePlay(id)} />
          ))}
        </div>
      </div>

      {result && (
        <BattleReplay matches={result.matches} tierLabel={config.battleTiers[result.tier]?.label || result.tier} status={result.status} reward={result.reward} rating={result.rating} onClose={handleCloseReplay} />
      )}
    </div>
  );
}
