import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, Users, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrawlRoster, getBrawlSpeciesCatalog, setBrawlTeam, type BrawlInstance, type BrawlSpecies } from '../../lib/brawlApi';
import { PokemonStatCard } from './PokemonStatCard';
import { PokemonPortrait } from './PokemonPortrait';
import { EvolveModal } from './EvolveModal';
import { groupIsMergeable } from './mergeEligibility';

function PokemonCard({ mon, selected, order, index, onClick }: { mon: BrawlInstance; selected: boolean; order: number | null; index: number; onClick: () => void }) {
  return <PokemonStatCard mon={mon} nickname={mon.nickname} selected={selected} order={order} index={index} onClick={onClick} />;
}

export function TeamTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['brawl-roster'], queryFn: getBrawlRoster });
  const { data: catalogData } = useQuery({ queryKey: ['brawl-species-catalog'], queryFn: getBrawlSpeciesCatalog, staleTime: 60 * 60_000 });
  const speciesCatalog = useMemo(() => new Map((catalogData?.species || []).map(s => [s.id, s] as [number, BrawlSpecies])), [catalogData]);
  const roster = data?.roster || [];
  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mergeSpeciesId, setMergeSpeciesId] = useState<number | null>(null);

  useEffect(() => {
    if (!initialized && roster.length) {
      setSelected(roster.filter(m => Number(m.is_on_team)).sort((a, b) => (a.team_slot || 0) - (b.team_slot || 0)).map(m => m.id));
      setInitialized(true);
    }
  }, [roster, initialized]);

  const initialActive = useMemo(() => roster.filter(m => Number(m.is_on_team)).map(m => m.id).sort().join(','), [roster]);
  const dirty = selected.slice().sort().join(',') !== initialActive;

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 6) { setToast('Active team is full (6/6) — remove one first'); setTimeout(() => setToast(null), 2500); return prev; }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (selected.length < 1) return;
    setSaving(true);
    try {
      await setBrawlTeam(selected);
      await qc.invalidateQueries({ queryKey: ['brawl-roster'] });
      setToast('Team saved');
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast(e.message || 'Failed to save team');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-white/40 text-sm py-16 text-center">Loading roster…</div>;

  const bench = roster.filter(m => !selected.includes(m.id));
  const benchGroups = new Map<number, BrawlInstance[]>();
  for (const mon of bench) {
    const group = benchGroups.get(mon.species_id);
    if (group) group.push(mon); else benchGroups.set(mon.species_id, [mon]);
  }
  const mergeableGroups = Array.from(benchGroups.values()).filter(g => g.length > 1 && groupIsMergeable(g));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-[#00c8ff]" />
          <h3 className="font-display text-sm uppercase tracking-widest text-white/70">Active Team ({selected.length}/6)</h3>
        </div>
        <motion.button whileHover={{ scale: dirty ? 1.03 : 1 }} whileTap={{ scale: 0.96 }} disabled={!dirty || saving || selected.length < 1} onClick={handleSave}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${dirty ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black shadow-[0_0_16px_rgba(0,200,255,0.3)]' : 'bg-white/5 text-white/30'}`}>
          <Check size={13} /> {saving ? 'Saving…' : 'Save Team'}
        </motion.button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 min-h-[6rem]">
        <AnimatePresence>
          {selected.length === 0 && <div className="col-span-2 sm:col-span-3 lg:col-span-6 text-white/30 text-xs py-6 text-center border border-dashed border-white/10 rounded-xl">Tap Pokemon below to add them to your active team.</div>}
          {selected.map((id, i) => { const mon = roster.find(m => m.id === id); if (!mon) return null; return <PokemonCard key={id} mon={mon} selected order={i + 1} index={i} onClick={() => toggle(id)} />; })}
        </AnimatePresence>
      </div>

      {mergeableGroups.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-[#facc15]" />
            <h3 className="font-display text-sm uppercase tracking-widest text-[#facc15]">Merge Available</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {mergeableGroups.map(group => {
              const mon = group[0];
              return (
                <button key={mon.species_id} onClick={() => setMergeSpeciesId(mon.species_id)}
                  className="shrink-0 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-[#facc15]/30 bg-[#facc15]/10 hover:bg-[#facc15]/20 transition-colors">
                  <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={mon.portrait_scale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y} className="w-8 h-8" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-white capitalize leading-tight">{mon.name}</div>
                    <div className="text-[10px] text-[#facc15] leading-tight">×{group.length} owned</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Users size={15} className="text-white/40" />
        <h3 className="font-display text-sm uppercase tracking-widest text-white/50">Bench ({bench.length})</h3>
      </div>
      {bench.length === 0 ? (
        <p className="text-white/30 text-xs">Everything you own is on your active team. Safari Zone and the shop will grow your bench.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {bench.map((mon, i) => <PokemonCard key={mon.id} mon={mon} selected={false} order={null} index={i} onClick={() => toggle(mon.id)} />)}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-xs text-white z-50">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {mergeSpeciesId != null && (
        <EvolveModal
          speciesId={mergeSpeciesId}
          instances={benchGroups.get(mergeSpeciesId) || []}
          speciesCatalog={speciesCatalog}
          onClose={() => { setMergeSpeciesId(null); qc.invalidateQueries({ queryKey: ['brawl-roster'] }); }}
        />
      )}
    </div>
  );
}
