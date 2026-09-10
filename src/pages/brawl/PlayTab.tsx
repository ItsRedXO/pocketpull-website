import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Clock, Coins, Trophy, Swords } from 'lucide-react';
import { getBrawlConfig, getBrawlProfile, playBrawlBattle, type BrawlBattlePlayResult } from '../../lib/brawlApi';
import { BattleReplay } from './BattleReplay';

function useCooldownLabel(cooldownEndsAt: string | null) {
  const [, setTick] = useState(0);
  React.useEffect(() => { if (!cooldownEndsAt) return; const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, [cooldownEndsAt]);
  if (!cooldownEndsAt) return null;
  const remainingMs = new Date(cooldownEndsAt).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const mins = Math.floor(remainingMs / 60000), secs = Math.floor((remainingMs % 60000) / 1000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m ${secs}s`;
}

function TierCard({ tierId, config, status, onPlay, playing }: { tierId: string; config: any; status: { unlocked: boolean; cooldownEndsAt: string | null } | undefined; onPlay: () => void; playing: boolean }) {
  const cooldownLabel = useCooldownLabel(status?.cooldownEndsAt || null);
  const locked = !status?.unlocked;
  const onCooldown = !!cooldownLabel;
  const disabled = locked || onCooldown || playing;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${locked ? 'border-white/5 bg-white/[0.015] opacity-60' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm uppercase tracking-wider text-white">{config.label}</h3>
        {locked && <Lock size={14} className="text-white/30" />}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-white/50">
        <span>{config.matches} match{config.matches > 1 ? 'es' : ''}</span>
        <span>Entry: {config.entryCost > 0 ? `${config.entryCost} pokedollars` : 'Free'}</span>
        {config.cooldownMs > 0 && <span>Cooldown: {config.cooldownMs >= 3600000 ? `${config.cooldownMs / 3600000}h` : `${config.cooldownMs / 60000}m`}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold">
        <Coins size={13} />
        {config.totalReward ? `${config.totalReward} pokedollars` : `${config.winReward} win / ${config.lossReward} loss`}
      </div>
      {locked && config.unlockAfter && (
        <p className="text-[10px] text-white/30">Unlocks after {config.unlockAfter.count} {config.unlockAfter.counter.replace(/_/g, ' ')}</p>
      )}
      <button onClick={onPlay} disabled={disabled} className={`mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${disabled ? 'bg-white/5 text-white/25' : 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black'}`}>
        {onCooldown ? <><Clock size={13} /> {cooldownLabel}</> : <><Swords size={13} /> Battle</>}
      </button>
    </div>
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
  };

  if (!config || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading tiers…</div>;

  const order = ['local_battle', 'local_tournament', 'state_tournament', 'regional_tournament', 'elite_four'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Trophy size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Battle Tiers</h3></div>
        <div className="text-[11px] text-white/40">{profile.dailyBattlesUsed}/{profile.dailyBattleCap} battles today</div>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {order.map(id => (
          <TierCard key={id} tierId={id} config={config.battleTiers[id]} status={profile.tierStatus[id]} playing={playingTier === id} onPlay={() => handlePlay(id)} />
        ))}
      </div>

      {result && (
        <BattleReplay matches={result.matches} tierLabel={config.battleTiers[result.tier]?.label || result.tier} status={result.status} reward={result.reward} onClose={handleCloseReplay} />
      )}
    </div>
  );
}
