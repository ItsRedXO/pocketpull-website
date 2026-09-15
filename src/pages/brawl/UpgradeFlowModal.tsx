import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Star, ArrowRight, Gift } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { starUpgradeBrawlRoster, STAR_UPGRADE_FODDER_COUNT, STAR_STAT_BONUS_PER_LEVEL, MAX_STAR_LEVEL, type BrawlInstance, type BrawlSpecies } from '../../lib/brawlApi';
import { PokemonPortrait } from './PokemonPortrait';
import { computeMergeEligibility } from './mergeEligibility';

function StarRow({ level, size = 14 }: { level: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: MAX_STAR_LEVEL }, (_, i) => (
        <Star key={i} size={size} fill={i < level ? '#facc15' : 'none'} className={i < level ? 'text-[#facc15]' : 'text-white/20'} />
      ))}
    </div>
  );
}

function statMult(starLevel: number) { return 1 + STAR_STAT_BONUS_PER_LEVEL * starLevel; }

export function UpgradeFlowModal({ speciesId, instances, speciesCatalog, onClose }: {
  speciesId: number; instances: BrawlInstance[]; speciesCatalog: Map<number, BrawlSpecies>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const species = speciesCatalog.get(speciesId);
  const [phase, setPhase] = useState<'confirm' | 'busy' | 'done'>('confirm');
  const [error, setError] = useState<string | null>(null);

  const { starTarget, fodderPool, canStarUp } = useMemo(() => computeMergeEligibility(instances), [instances]);

  if (!species || !starTarget) return null;

  const currentStar = starTarget.star_level;
  const nextStar = currentStar + 1;
  const oldMult = statMult(currentStar);
  const newMult = statMult(nextStar);
  const stats: [string, number][] = [
    ['ATK', starTarget.base_attack], ['DEF', starTarget.base_defense], ['HP', starTarget.base_hp], ['SPD', starTarget.base_speed],
  ];

  const handleConfirm = async () => {
    if (!canStarUp) return;
    setPhase('busy'); setError(null);
    try {
      const fodder = fodderPool.slice(0, STAR_UPGRADE_FODDER_COUNT).map(i => i.id);
      await starUpgradeBrawlRoster(starTarget.id, fodder);
      await qc.invalidateQueries({ queryKey: ['brawl-roster'] });
      setPhase('done');
    } catch (e: any) {
      setError(e.message || 'Star upgrade failed');
      setPhase('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={phase !== 'busy' ? onClose : undefined}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#facc15]">
            <Star size={12} /> Star Upgrade
          </div>
          {phase !== 'busy' && <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>}
        </div>

        {phase === 'done' ? (
          <div className="p-6 text-center">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="flex flex-col items-center gap-3">
              <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-20 h-20" />
              <StarRow level={nextStar} size={18} />
              <div className="text-white font-bold">Upgraded to {nextStar}★!</div>
            </motion.div>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-[#facc15] to-[#f59e0b] text-black font-bold text-xs uppercase tracking-wider">Nice!</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-20 h-20" />
              <span className="text-sm font-bold text-white capitalize">{species.name}</span>
              <div className="flex items-center gap-2">
                <StarRow level={currentStar} />
                <ArrowRight size={12} className="text-white/30" />
                <StarRow level={nextStar} />
              </div>
            </div>

            <p className="text-center text-sm text-white">
              Are you sure you want to upgrade <span className="font-bold capitalize">{species.name}</span>?
            </p>

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-4 text-center">
                {stats.map(([label, base]) => {
                  const oldVal = Math.round(base * oldMult);
                  const newVal = Math.round(base * newMult);
                  return (
                    <div key={label} className="py-2 border-r last:border-r-0 border-white/10">
                      <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">{label}</div>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="text-xs text-white/40">{oldVal}</span>
                        <ArrowRight size={9} className="text-white/20" />
                        <span className="text-sm font-black text-[#facc15]">{newVal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-[11px] text-white/40">
              This uses {STAR_UPGRADE_FODDER_COUNT} duplicate copies of {species.name} from your bench.
            </p>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <div className="flex items-start gap-1.5 text-[10px] text-white/30 px-1">
              <Gift size={11} className="mt-0.5 shrink-0" />
              Each star unlocks one held-item slot (items are coming soon) and gives a small permanent stat boost.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={onClose} disabled={phase === 'busy'} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 text-white/60 hover:bg-white/10">
                Cancel
              </button>
              <button disabled={!canStarUp || phase === 'busy'} onClick={handleConfirm}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider ${canStarUp ? 'bg-gradient-to-r from-[#facc15] to-[#f59e0b] text-black' : 'bg-white/5 text-white/25 cursor-default'}`}>
                {phase === 'busy' ? 'Upgrading…' : 'Yes'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
