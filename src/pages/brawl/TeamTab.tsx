import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Users } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrawlRoster, setBrawlTeam, type BrawlInstance } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

function PokemonCard({ mon, selected, order, onClick }: { mon: BrawlInstance; selected: boolean; order: number | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative rounded-xl border p-2 flex flex-col items-center text-left transition-colors ${selected ? 'border-[#00c8ff] bg-[#00c8ff]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
      {selected && <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#00c8ff] text-black text-[10px] font-bold flex items-center justify-center">{order}</span>}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
        {mon.artwork_url ? <img src={mon.artwork_url} alt={mon.name} className="w-full h-full object-contain scale-150" style={{ objectPosition: 'top' }} /> : null}
      </div>
      <div className="text-[11px] font-bold text-white capitalize mt-1 truncate w-full text-center">{mon.nickname || mon.name}</div>
      <div className="flex gap-1 mt-1 justify-center">
        <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(mon.primary_type)}30`, color: typeColor(mon.primary_type) }}>{mon.primary_type}</span>
        {mon.secondary_type && <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(mon.secondary_type)}30`, color: typeColor(mon.secondary_type) }}>{mon.secondary_type}</span>}
      </div>
      <div className="text-[10px] text-[#00c8ff] font-bold mt-1">OVR {mon.overall_rating}</div>
    </button>
  );
}

export function TeamTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['brawl-roster'], queryFn: getBrawlRoster });
  const roster = data?.roster || [];
  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-[#00c8ff]" />
          <h3 className="font-display text-sm uppercase tracking-widest text-white/70">Active Team ({selected.length}/6)</h3>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} disabled={!dirty || saving || selected.length < 1} onClick={handleSave}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${dirty ? 'bg-[#00c8ff] text-black' : 'bg-white/5 text-white/30'}`}>
          <Check size={13} /> {saving ? 'Saving…' : 'Save Team'}
        </motion.button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8 min-h-[6rem]">
        {selected.length === 0 && <div className="col-span-6 text-white/30 text-xs py-6 text-center border border-dashed border-white/10 rounded-xl">Tap Pokemon below to add them to your active team.</div>}
        {selected.map((id, i) => { const mon = roster.find(m => m.id === id); if (!mon) return null; return <PokemonCard key={id} mon={mon} selected order={i + 1} onClick={() => toggle(id)} />; })}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Users size={15} className="text-white/40" />
        <h3 className="font-display text-sm uppercase tracking-widest text-white/50">Bench ({bench.length})</h3>
      </div>
      {bench.length === 0 ? (
        <p className="text-white/30 text-xs">Everything you own is on your active team. Safari Zone and the shop will grow your bench.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {bench.map(mon => <PokemonCard key={mon.id} mon={mon} selected={false} order={null} onClick={() => toggle(mon.id)} />)}
        </div>
      )}

      {toast && <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-xs text-white z-50">{toast}</div>}
    </div>
  );
}
