import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles, SkipForward } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { evolveBrawlRoster, type BrawlInstance, type BrawlSpecies } from '../../lib/brawlApi';
import { PokemonPortrait } from './PokemonPortrait';
import { computeMergeEligibility } from './mergeEligibility';

type Stage = 'flash' | 'silhouette' | 'reveal';

/** Silhouette look during the mid-animation crossfade -- flattens the
 * artwork to a stark black shape so the "who's evolving" beat reads even
 * before the target's real colors are known. */
const SILHOUETTE_FILTER = 'brightness(0) drop-shadow(0 0 18px rgba(155,92,255,0.8))';

export function EvolveFlowModal({ speciesId, instances, speciesCatalog, onClose }: {
  speciesId: number; instances: BrawlInstance[]; speciesCatalog: Map<number, BrawlSpecies>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const species = speciesCatalog.get(speciesId);
  const [targetSpeciesId, setTargetSpeciesId] = useState<number | null>(species?.evolves_to[0] ?? null);
  const [phase, setPhase] = useState<'confirm' | 'evolving'>('confirm');
  const [stage, setStage] = useState<Stage>('flash');
  const [apiDone, setApiDone] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Freeze the bench group as it was when this modal opened -- confirming
  // triggers a roster refetch, and a live `instances` prop can shrink to
  // nothing (or even briefly empty out) while this modal is still showing
  // its animation/result, which would otherwise recompute eligibility off
  // of stale/empty data mid-flow.
  const [frozenInstances] = useState(instances);
  const { unstarred, evolveCost, canEvolve } = useMemo(() => computeMergeEligibility(frozenInstances), [frozenInstances]);

  // Advance flash -> silhouette -> reveal on a timer; skipping just jumps
  // straight to 'reveal' (which itself waits for the API if it's not back yet).
  useEffect(() => {
    if (phase !== 'evolving') return;
    if (stage === 'flash') { const t = setTimeout(() => setStage('silhouette'), 850); return () => clearTimeout(t); }
    if (stage === 'silhouette') { const t = setTimeout(() => setStage('reveal'), 900); return () => clearTimeout(t); }
  }, [phase, stage]);

  if (!species) return null;
  const targetSpecies = targetSpeciesId != null ? speciesCatalog.get(targetSpeciesId) : null;
  const revealReady = stage === 'reveal' && apiDone && !apiError;

  const handleConfirm = async () => {
    if (!targetSpeciesId || !canEvolve || submittingRef.current) return;
    submittingRef.current = true;
    setPhase('evolving'); setStage('flash'); setApiDone(false); setApiError(null);
    try {
      const chosen = unstarred.slice(0, evolveCost).map(i => i.id);
      await evolveBrawlRoster(speciesId, targetSpeciesId, chosen);
      await qc.invalidateQueries({ queryKey: ['brawl-roster'] });
      qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
      setApiDone(true);
    } catch (e: any) {
      setApiError(e.message || 'Evolve failed');
      setApiDone(true);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleSkip = () => setStage('reveal');

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={phase === 'confirm' ? onClose : undefined}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}>

        {phase === 'confirm' && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#00c8ff]">
                <ArrowRight size={12} /> Evolve
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-20 h-20" />
                  <span className="text-xs font-bold text-white capitalize">{species.name}</span>
                </div>
                <ArrowRight size={20} className="text-white/30 shrink-0" />
                <div className="flex flex-col items-center gap-1">
                  {targetSpecies && <PokemonPortrait artworkUrl={targetSpecies.artwork_url} alt={targetSpecies.name} scale={targetSpecies.portrait_scale} offsetX={targetSpecies.portrait_offset_x} offsetY={targetSpecies.portrait_offset_y} className="w-20 h-20" />}
                  <span className="text-xs font-bold text-white capitalize">{targetSpecies?.name || '?'}</span>
                </div>
              </div>

              {species.evolves_to.length > 1 && (
                <div className="flex gap-1.5 justify-center flex-wrap">
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

              <p className="text-center text-sm text-white">
                Are you sure you want to evolve <span className="font-bold capitalize">{species.name}</span>?
              </p>
              <p className="text-center text-[11px] text-white/40">
                This uses {evolveCost} duplicate copies of {species.name} from your bench.
              </p>

              {apiError && <p className="text-red-400 text-xs text-center">{apiError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 text-white/60 hover:bg-white/10">
                  Cancel
                </button>
                <button disabled={!canEvolve} onClick={handleConfirm}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider ${canEvolve ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black' : 'bg-white/5 text-white/25 cursor-default'}`}>
                  Yes
                </button>
              </div>
            </div>
          </>
        )}

        {phase === 'evolving' && (
          <div className="relative p-6 min-h-[320px] flex flex-col items-center justify-center text-center overflow-hidden">
            {!revealReady && (
              <button onClick={handleSkip} className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-bold uppercase tracking-wider z-10">
                <SkipForward size={11} /> Skip
              </button>
            )}

            <AnimatePresence mode="wait">
              {stage === 'flash' && (
                <motion.div key="flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                  <motion.div animate={{ boxShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 60px rgba(255,255,255,0.9)', '0 0 0px rgba(255,255,255,0)'] }}
                    transition={{ repeat: Infinity, duration: 0.7 }} className="rounded-full">
                    <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-28 h-28" />
                  </motion.div>
                  <p className="text-white font-bold text-sm">What? <span className="capitalize">{species.name}</span> is evolving!</p>
                </motion.div>
              )}

              {stage === 'silhouette' && (
                <motion.div key="silhouette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                  <div className="relative w-28 h-28">
                    <motion.div animate={{ opacity: [1, 0] }} transition={{ duration: 0.9 }} className="absolute inset-0" style={{ filter: SILHOUETTE_FILTER }}>
                      <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-28 h-28" />
                    </motion.div>
                    {targetSpecies && (
                      <motion.div animate={{ opacity: [0, 1] }} transition={{ duration: 0.9 }} className="absolute inset-0" style={{ filter: SILHOUETTE_FILTER }}>
                        <PokemonPortrait artworkUrl={targetSpecies.artwork_url} alt={targetSpecies.name} scale={targetSpecies.portrait_scale} offsetX={targetSpecies.portrait_offset_x} offsetY={targetSpecies.portrait_offset_y} className="w-28 h-28" />
                      </motion.div>
                    )}
                    {Array.from({ length: 6 }, (_, i) => (
                      <motion.span key={i} className="absolute" style={{ top: '50%', left: '50%' }}
                        animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 70, y: Math.sin((i / 6) * Math.PI * 2) * 70, opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.08 }}>
                        <Sparkles size={14} className="text-[#00c8ff]" />
                      </motion.span>
                    ))}
                  </div>
                  <p className="text-white/70 text-xs">...</p>
                </motion.div>
              )}

              {stage === 'reveal' && !revealReady && (
                <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                  <div style={{ filter: SILHOUETTE_FILTER }}>
                    {targetSpecies ? (
                      <PokemonPortrait artworkUrl={targetSpecies.artwork_url} alt={targetSpecies.name} scale={targetSpecies.portrait_scale} offsetX={targetSpecies.portrait_offset_x} offsetY={targetSpecies.portrait_offset_y} className="w-28 h-28" />
                    ) : (
                      <PokemonPortrait artworkUrl={species.artwork_url} alt={species.name} scale={species.portrait_scale} offsetX={species.portrait_offset_x} offsetY={species.portrait_offset_y} className="w-28 h-28" />
                    )}
                  </div>
                  <p className="text-white/50 text-xs">Finishing up…</p>
                </motion.div>
              )}

              {revealReady && (
                <motion.div key="reveal" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="flex flex-col items-center gap-3">
                  {apiError ? (
                    <>
                      <p className="text-red-400 text-sm">{apiError}</p>
                      <button onClick={onClose} className="mt-2 px-5 py-2 rounded-xl bg-white/10 text-white font-bold text-xs uppercase tracking-wider">Close</button>
                    </>
                  ) : (
                    <>
                      <motion.div animate={{ boxShadow: ['0 0 0px rgba(0,200,255,0)', '0 0 50px rgba(0,200,255,0.7)', '0 0 20px rgba(0,200,255,0.4)'] }} transition={{ duration: 1 }} className="rounded-full">
                        {targetSpecies && <PokemonPortrait artworkUrl={targetSpecies.artwork_url} alt={targetSpecies.name} scale={targetSpecies.portrait_scale} offsetX={targetSpecies.portrait_offset_x} offsetY={targetSpecies.portrait_offset_y} className="w-28 h-28" />}
                      </motion.div>
                      <p className="text-white font-bold text-sm px-4">
                        Congratulations! Your <span className="capitalize">{species.name}</span> evolved into <span className="capitalize">{targetSpecies?.name}</span>!
                      </p>
                      <button onClick={onClose} className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-xs uppercase tracking-wider">Nice!</button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
