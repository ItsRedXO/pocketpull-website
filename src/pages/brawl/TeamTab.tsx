import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, Users, Search, ArrowUpDown, LayoutGrid, Rows3 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrawlRoster, setBrawlTeam, type BrawlInstance } from '../../lib/brawlApi';
import { PokemonStatCard } from './PokemonStatCard';

type SortKey = 'power' | 'name';

function PokemonCard({ mon, selected, order, index, count, onClick }: { mon: BrawlInstance; selected: boolean; order: number | null; index: number; count?: number; onClick: () => void }) {
  return <PokemonStatCard mon={mon} nickname={mon.nickname} selected={selected} order={order} index={index} count={count} onClick={onClick} />;
}

export function TeamTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['brawl-roster'], queryFn: getBrawlRoster });
  const roster = data?.roster || [];
  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [benchSearch, setBenchSearch] = useState('');
  const [benchSort, setBenchSort] = useState<SortKey>('power');
  const [benchDense, setBenchDense] = useState(false);

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
  // One card per species (duplicates collapse into a single "(xN)" card),
  // highest overall rating first -- otherwise strong Pokemon get buried
  // among a long acquisition-order list of commons.
  const benchDisplayGroups = Array.from(benchGroups.values())
    .filter(group => group[0].name.toLowerCase().includes(benchSearch.trim().toLowerCase()))
    .sort((a, b) => benchSort === 'name' ? a[0].name.localeCompare(b[0].name) : b[0].overall_rating - a[0].overall_rating);

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

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-white/40" />
          <h3 className="font-display text-sm uppercase tracking-widest text-white/50">Bench ({bench.length})</h3>
        </div>
        {bench.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={benchSearch} onChange={e => setBenchSearch(e.target.value)} placeholder="Search Pokémon..."
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00c8ff]/50 w-40" />
            </div>
            <button onClick={() => setBenchSort(s => s === 'power' ? 'name' : 'power')}
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/60 hover:text-white hover:bg-white/10">
              <ArrowUpDown size={12} /> Sort: {benchSort === 'power' ? 'Power' : 'Name'}
            </button>
            <button onClick={() => setBenchDense(d => !d)}
              className="flex items-center justify-center bg-white/5 border border-white/10 rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10">
              {benchDense ? <Rows3 size={14} /> : <LayoutGrid size={14} />}
            </button>
          </div>
        )}
      </div>
      {bench.length === 0 ? (
        <p className="text-white/30 text-xs">Everything you own is on your active team. Safari Zone and the shop will grow your bench.</p>
      ) : benchDisplayGroups.length === 0 ? (
        <p className="text-white/30 text-xs">No Pokémon match "{benchSearch}".</p>
      ) : (
        <div className={`grid gap-3 ${benchDense ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
          <AnimatePresence>
            {benchDisplayGroups.map((group, i) => {
              const mon = group[0];
              return <PokemonCard key={mon.species_id} mon={mon} selected={false} order={null} index={i} count={group.length} onClick={() => toggle(mon.id)} />;
            })}
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
    </div>
  );
}
