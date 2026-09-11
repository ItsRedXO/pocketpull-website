import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, Star, Sparkles, Gift } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { evolveBrawlRoster, starUpgradeBrawlRoster, STAR_UPGRADE_FODDER_COUNT, MAX_STAR_LEVEL, type BrawlInstance, type BrawlSpecies } from '../../lib/brawlApi';
import { PokemonPortrait } from './PokemonPortrait';
import { computeMergeEligibility } from './mergeEligibility';

function StarRow({ level, size = 12 }: { level: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: MAX_STAR_LEVEL }, (_, i) => (
        <Star key={i} size={size} fill={i < level ? '#facc15' : 'none'} className={i < level ? 'text-[#facc15]' : 'text-white/20'} />
      ))}
    </div>
  );
}

export function EvolveModal({ speciesId, instances, speciesCatalog, onClose }: {
  speciesId: number; instances: BrawlInstance[]; speciesCatalog: Map<number, BrawlSpecies>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const species = speciesCatalog.get(speciesId);
  const [targetSpeciesId, setTargetSpeciesId] = useState<number | null>(species?.evolves_to[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const { unstarred, evolveCost, canEvolve, starTarget, fodderPool, canStarUp } = useMemo(
    () => computeMergeEligibility(instances),
    [instances],
  );

  if (!species) return null;
  const targetSpecies = targetSpeciesId != null ? speciesCatalog.get(targetSpeciesId) : null;

  const handleEvolve = async () => {
    if (!targetSpeciesId || !canEvolve) return;
    setBusy(true); setError(null);
    try {
      const chosen = unstarred.slice(0, evolveCost).map(i => i.id);
      await evolveBrawlRoster(speciesId, targetSpeciesId, chosen);
      await qc.invalidateQueries({ queryKey: ['brawl-roster'] });
      qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
      setResult(`Evolved into ${targetSpecies?.name || 'the next stage'}!`);
    } catch (e: any) {
      setError(e.message || 'Evolve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStarUp = async () => {
    if (!starTarget || !canStarUp) return;
    setBusy(true); setError(null);
    try {
      const fodder = fodderPool.slice(0, STAR_UPGRADE_FODDER_COUNT).map(i => i.id);
      const res = await starUpgradeBrawlRoster(starTarget.id, fodder);
      await qc.invalidateQueries({ queryKey: ['brawl-roster'] });
      setResult(`Upgraded to ${res.newStarLevel}★!`);
    } catch (e: any) {
      setError(e.message || 'Star upgrade failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-9 h-9" />
            <div>
              <div className="text-sm font-bold text-white capitalize">{species.name}</div>
              <div className="text-[10px] text-white/40">{instances.length} owned (bench)</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <Sparkles size={32} className="mx-auto text-[#facc15] mb-3" />
            <div className="text-white font-bold mb-4">{result}</div>
            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-xs uppercase tracking-wider">Nice!</button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {error && <p className="text-red-400 text-xs">{error}</p>}

            {species.evolves_to.length > 0 && (
              <div className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">
                  <ArrowRight size={12} /> Evolve
                </div>
                {species.evolves_to.length > 1 && (
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {species.evolves_to.map(id => {
                      const s = speciesCatalog.get(id);
                      if (!s) return null;
                      return (
                        <button key={id} onClick={() => setTargetSpeciesId(id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase capitalize border ${targetSpeciesId === id ? 'border-[#00c8ff] text-[#00c8ff] bg-[#00c8ff]/10' : 'border-white/10 text-white/50'}`}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {targetSpecies && <PokemonPortrait artworkUrl={targetSpecies.artwork_url} alt={targetSpecies.name} scale={targetSpecies.portrait_scale} offsetX={targetSpecies.portrait_offset_x} offsetY={targetSpecies.portrait_offset_y} className="w-8 h-8 shrink-0" />}
                    <span className="text-xs text-white/70 capitalize truncate">
                      {evolveCost}× {species.name} <ArrowRight size={10} className="inline" /> 1× {targetSpecies?.name || '?'}
                    </span>
                  </div>
                  <button disabled={!canEvolve || busy} onClick={handleEvolve}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${canEvolve ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black' : 'bg-white/5 text-white/25 cursor-default'}`}>
                    {canEvolve ? 'Evolve' : `${unstarred.length}/${evolveCost}`}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/10 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">
                <Star size={12} /> Star Upgrade
              </div>
              {starTarget ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-white/70">+{STAR_UPGRADE_FODDER_COUNT} copies (5 total touched)</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StarRow level={starTarget.star_level} />
                        <ArrowRight size={10} className="text-white/30" />
                        <StarRow level={starTarget.star_level + 1} />
                      </div>
                    </div>
                  </div>
                  <button disabled={!canStarUp || busy} onClick={handleStarUp}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${canStarUp ? 'bg-gradient-to-r from-[#facc15] to-[#f59e0b] text-black' : 'bg-white/5 text-white/25 cursor-default'}`}>
                    {canStarUp ? 'Upgrade' : `${fodderPool.length}/${STAR_UPGRADE_FODDER_COUNT}`}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-white/30">Already at max star level (★★★).</p>
              )}
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-white/30 px-1">
              <Gift size={11} className="mt-0.5 shrink-0" />
              Each star unlocks one held-item slot (items are coming soon) and gives a small permanent stat boost.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
