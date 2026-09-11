import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trees, Coins, Sparkles, X, Wand2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrawlConfig, getBrawlProfile, getBrawlSpeciesCatalog, pullSafariZone, type BrawlSpecies, type SafariTierConfig } from '../../lib/brawlApi';
import { typeColor } from './typeColors';
import { PokemonPortrait } from './PokemonPortrait';
import { getCardTier } from './PokemonStatCard';

const TIER_COLORS = ['#8892a4', '#6890f0', '#9b5cff', '#f97316', '#facc15'];

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** What a tier card should tease as "possible pulls". Tier 5 (Legends
 * Encounter) specifically showcases actual Legendaries rather than whatever
 * happens to fall in its overall band -- the point is to show off the
 * aspirational catch, not the literal per-pull odds. Everything else samples
 * from the tier's real pool (guaranteed + bonus range combined, so a tier's
 * standout bonus-only mon like a Mythical still gets a chance to show up). */
function tierPreviewPool(species: BrawlSpecies[], tier: SafariTierConfig): BrawlSpecies[] {
  if (tier.tier === 5) {
    const legendaries = species.filter(s => s.is_legendary);
    if (legendaries.length) return legendaries;
  }
  const stageOk = (s: BrawlSpecies) => !tier.stages || tier.stages.includes(s.evolution_stage);
  const rarityOk = (s: BrawlSpecies) => (!tier.excludeLegendary || !s.is_legendary) && (!tier.excludeMythical || !s.is_mythical);
  const rangeOk = (s: BrawlSpecies) => s.overall_rating >= tier.overallMin && s.overall_rating <= tier.bonusOverallMax;
  const pool = species.filter(s => stageOk(s) && rarityOk(s) && rangeOk(s));
  return pool.length ? pool : species;
}

function TierPreview({ species, tier, color }: { species: BrawlSpecies[]; tier: SafariTierConfig; color: string }) {
  const preview = useMemo(() => shuffled(tierPreviewPool(species, tier)).slice(0, 2), [species, tier]);
  if (!preview.length) return null;
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[8px] uppercase tracking-widest text-white/25">Could get</span>
      <div className="flex -space-x-2">
        {preview.map(p => (
          <div key={p.id} title={p.name} className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: `${color}80`, background: '#0d0e14' }}>
            <PokemonPortrait artworkUrl={p.artwork_url} alt={p.name} scale={(p.portrait_scale || 1.5) * 1.1} offsetX={p.portrait_offset_x} offsetY={p.portrait_offset_y} className="w-full h-full" />
          </div>
        ))}
      </div>
      <span className="text-[9px] text-white/40 capitalize truncate">{preview.map(p => p.name).join(' · ')}</span>
    </div>
  );
}

function RevealCard({ mon, index, ready }: { mon: BrawlSpecies; index: number; ready: boolean }) {
  const tier = getCardTier(mon);
  const flashy = tier === 'gold' || tier === 'legendary';
  const color = typeColor(mon.primary_type);
  const delay = index * 0.22;

  return (
    <div className="relative w-28">
      <AnimatePresence>
        {ready && (
          <motion.div key="burst" className="absolute inset-0 rounded-full pointer-events-none" style={{ background: color }}
            initial={{ opacity: 0.8, scale: 0.2 }} animate={{ opacity: 0, scale: flashy ? 2.6 : 1.8 }} transition={{ delay, duration: 0.5 }} />
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.6, rotate: -10 }}
        animate={ready ? {
          opacity: 1, y: 0, scale: 1, rotate: 0,
          boxShadow: flashy
            ? [`0 0 16px ${color}55`, `0 0 30px ${color}90`, `0 0 16px ${color}55`]
            : `0 4px 14px rgba(0,0,0,0.4), 0 0 14px ${color}35`,
        } : {}}
        transition={{ delay, type: 'spring', stiffness: 260, damping: 16, boxShadow: flashy ? { repeat: Infinity, duration: 1.6, delay: delay + 0.4 } : undefined }}
        className="relative rounded-xl border p-3 flex flex-col items-center"
        style={{ borderColor: `${color}60`, background: `linear-gradient(160deg, ${color}1c 0%, rgba(13,14,20,0.9) 70%)` }}
      >
        {flashy && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={ready ? { opacity: [0, 1, 0], scale: 1.3 } : {}} transition={{ delay: delay + 0.15, duration: 0.6 }}
            className="absolute -top-2 -right-2 text-[#facc15]">
            <Sparkles size={16} />
          </motion.div>
        )}
        <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={mon.portrait_scale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y} className="w-20 h-20 rounded-lg" />
        <div className="text-xs font-bold text-white capitalize mt-1 truncate w-full text-center">{mon.name}</div>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold mt-1" style={{ background: `${color}30`, color }}>{mon.primary_type}</span>
        <div className="text-[11px] text-[#00c8ff] font-bold mt-1">OVR {mon.overall_rating}</div>
      </motion.div>
    </div>
  );
}

export function SafariZoneTab() {
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['brawl-config'], queryFn: getBrawlConfig, staleTime: 60_000 });
  const { data: profile } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile });
  const { data: catalog } = useQuery({ queryKey: ['brawl-species-catalog'], queryFn: getBrawlSpeciesCatalog, staleTime: 60 * 60_000 });
  const [pulling, setPulling] = useState<number | null>(null);
  const [pulled, setPulled] = useState<BrawlSpecies[] | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePull = async (tier: number) => {
    setError(null);
    setPulling(tier);
    try {
      const res = await pullSafariZone(tier);
      setPulled(res.pulled);
      setRevealReady(false);
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
      qc.invalidateQueries({ queryKey: ['brawl-roster'] });
    } catch (e: any) {
      setError(e.message || 'Pull failed');
    } finally {
      setPulling(null);
    }
  };

  useEffect(() => {
    if (!pulled) return;
    const t = setTimeout(() => setRevealReady(true), 550);
    return () => clearTimeout(t);
  }, [pulled]);

  const handleClose = () => { setPulled(null); setRevealReady(false); };

  if (!config || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading Safari Zone…</div>;
  const species = catalog?.species || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Trees size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Safari Zone</h3></div>
        <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold"><Coins size={13} /> {profile.balance.toLocaleString()} pokedollars</div>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {config.safariTiers.map((t, i) => {
          const affordable = profile.balance >= t.cost;
          const isPulling = pulling === t.tier;
          const color = TIER_COLORS[i % TIER_COLORS.length];
          return (
            <motion.div key={t.tier} initial={{ opacity: 0, y: 14 }} animate={{
              opacity: 1, y: 0,
              boxShadow: isPulling ? [`0 0 0px ${color}00`, `0 0 24px ${color}80`, `0 0 0px ${color}00`] : `0 0 0px ${color}00`,
            }} transition={{ delay: i * 0.05, boxShadow: isPulling ? { repeat: Infinity, duration: 0.9 } : undefined }}
              whileHover={{ y: -3 }}
              className="relative rounded-xl border p-4 flex flex-col gap-2 overflow-hidden"
              style={{ borderColor: `${color}45`, background: `linear-gradient(160deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)` }}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30" style={{ background: color }} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Tier {t.tier}</span>
              <h4 className="font-display text-sm uppercase tracking-wider -mt-1" style={{ color }}>{t.label}</h4>
              <div className="text-[11px] text-white/50">{t.description}</div>
              <TierPreview species={species} tier={t} color={color} />
              <div className="flex items-center gap-1.5 text-[#facc15] text-sm font-bold mt-1"><Coins size={14} /> {t.cost.toLocaleString()}</div>
              <motion.button onClick={() => handlePull(t.tier)} disabled={!affordable || isPulling}
                whileHover={affordable ? { scale: 1.03 } : undefined} whileTap={affordable ? { scale: 0.96 } : undefined}
                className="mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
                style={affordable ? { background: `linear-gradient(90deg, ${color}, #00c8ff)`, color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
                {isPulling ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}><Wand2 size={13} /></motion.span> : <Sparkles size={13} />}
                {isPulling ? 'Searching…' : affordable ? 'Enter Safari Zone' : 'Not enough pokedollars'}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {pulled && (
          <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl border border-white/10 p-6 max-w-md w-full text-center relative overflow-hidden" style={{ background: '#0d0e14' }}>
              <AnimatePresence>
                {!revealReady && (
                  <motion.div key="portal" exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div animate={{ rotate: 360, scale: [1, 1.15, 1] }} transition={{ rotate: { repeat: Infinity, duration: 1.1, ease: 'linear' }, scale: { repeat: Infinity, duration: 0.7 } }}
                      className="w-24 h-24 rounded-full" style={{ background: 'conic-gradient(from 0deg, #9b5cff, #00c8ff, #facc15, #9b5cff)', filter: 'blur(2px)', opacity: 0.6 }} />
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleClose} className="absolute top-3 right-3 text-white/40 hover:text-white z-10"><X size={16} /></button>
              <h3 className="font-display text-lg uppercase tracking-widest text-white mb-4">Safari Zone Catch!</h3>
              <div className="flex justify-center gap-4 min-h-[9.5rem]">
                {pulled.map((p, i) => <RevealCard key={p.id + i} mon={p} index={i} ready={revealReady} />)}
              </div>
              <AnimatePresence>
                {revealReady && (
                  <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pulled.length * 0.22 + 0.2 }}
                    onClick={handleClose} className="mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">
                    Nice!
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
