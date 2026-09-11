import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Search, Swords } from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';
import { PokemonPortrait } from '../pages/brawl/PokemonPortrait';

interface BrawlSpecies {
  id: number; name: string; primary_type: string; secondary_type: string | null;
  base_hp: number; base_attack: number; base_defense: number; base_sp_attack: number; base_sp_defense: number; base_speed: number;
  overall_rating: number; evolution_stage: number; is_legendary: number; is_mythical: number;
  card_tier_override: string | null; sprite_url: string | null; artwork_url: string | null;
  portrait_scale: number; portrait_offset_x: number; portrait_offset_y: number;
}

// Special attack/defense are edited elsewhere (they're battle-relevant but
// not something admins need to eyeball in this table) -- HP/ATK/DEF/SPD plus
// Overall and Stage is the at-a-glance set.
const STAT_KEYS = ['base_hp', 'base_attack', 'base_defense', 'base_speed'] as const;
const STAT_LABELS: Record<typeof STAT_KEYS[number], string> = {
  base_hp: 'HP', base_attack: 'ATK', base_defense: 'DEF', base_speed: 'SPD',
};
const PORTRAIT_KEYS = ['portrait_scale', 'portrait_offset_x', 'portrait_offset_y'] as const;
const PORTRAIT_LABELS: Record<typeof PORTRAIT_KEYS[number], string> = {
  portrait_scale: 'Zoom', portrait_offset_x: 'Pan X', portrait_offset_y: 'Pan Y',
};
const TIER_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'legendary', label: 'Legendary' },
];

async function adminHeaders(): Promise<Record<string, string>> {
  const token = await blink.auth.getValidToken();
  const secret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(secret ? { 'X-Admin-Secret': secret } : {}),
  };
}

async function fetchSpecies(): Promise<BrawlSpecies[]> {
  const res = await fetch(`${BACKEND_BASE}/admin/brawl/species`, { headers: await adminHeaders() });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || 'Failed to load Poke Brawl species');
  return payload.species || [];
}

async function saveSpecies(id: number, fields: Record<string, unknown>): Promise<BrawlSpecies> {
  const res = await fetch(`${BACKEND_BASE}/admin/brawl/species/${id}`, { method: 'PATCH', headers: await adminHeaders(), body: JSON.stringify(fields) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) throw new Error(payload?.error || 'Save failed');
  return payload.species;
}

export function BrawlSpeciesTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const { data: species = [], isLoading } = useQuery<BrawlSpecies[]>({ queryKey: ['admin-brawl-species'], queryFn: fetchSpecies, staleTime: 15000 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return species;
    return species.filter(s => s.name.toLowerCase().includes(q) || String(s.id) === q || s.primary_type.includes(q) || (s.secondary_type || '').includes(q));
  }, [species, search]);

  const setEdit = (id: number, key: string, value: string) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  const rowEdits = (id: number) => edits[id] || {};
  const valueFor = (row: BrawlSpecies, key: string) => rowEdits(row.id)[key] ?? String((row as any)[key] ?? '');
  const numberFor = (row: BrawlSpecies, key: string) => { const v = rowEdits(row.id)[key]; return v !== undefined ? Number(v) : Number((row as any)[key]); };
  const isDirty = (id: number) => Object.keys(edits[id] || {}).length > 0;

  const handleSave = async (row: BrawlSpecies) => {
    const changes = rowEdits(row.id);
    if (!Object.keys(changes).length) return;
    setSavingId(row.id);
    try {
      const numericKeys = new Set<string>([...STAT_KEYS, ...PORTRAIT_KEYS, 'overall_rating']);
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) fields[key] = numericKeys.has(key) ? Number(value) : value;
      const updated = await saveSpecies(row.id, fields);
      qc.setQueryData<BrawlSpecies[]>(['admin-brawl-species'], (prev = []) => prev.map(s => (s.id === updated.id ? updated : s)));
      setEdits(prev => { const next = { ...prev }; delete next[row.id]; return next; });
      showToast(`${updated.name} updated`);
    } catch (e: any) {
      showToast(e.message || 'Failed to save', false);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-[#9b5cff]" />
          <h2 className="font-display text-sm uppercase tracking-widest text-white/70">Poke Brawl — Species</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white/40 bg-white/5">{species.length} loaded</span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, id, or type"
            className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 w-64" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading species…</div>
      ) : species.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">
          No species imported yet. Run <code className="text-[#00c8ff]">npm run brawl:import-species</code> against the database.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Portrait</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Type</th>
                {STAT_KEYS.map(k => <th key={k} className="px-2 py-2 text-center">{STAT_LABELS[k]}</th>)}
                <th className="px-2 py-2 text-center">Overall</th>
                <th className="px-2 py-2 text-center">Stage</th>
                <th className="px-2 py-2 text-center text-[#facc15]/80">Tier</th>
                {PORTRAIT_KEYS.map(k => <th key={k} className="px-2 py-2 text-center text-[#00c8ff]/70">{PORTRAIT_LABELS[k]}</th>)}
                <th className="px-2 py-2 text-center">Save</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className={`border-t border-white/5 ${isDirty(row.id) ? 'bg-[#9b5cff]/5' : ''}`}>
                  <td className="px-2 py-1.5 text-white/40">{row.id}</td>
                  <td className="px-2 py-1.5">
                    <PokemonPortrait artworkUrl={row.artwork_url} alt={row.name}
                      scale={numberFor(row, 'portrait_scale')} offsetX={numberFor(row, 'portrait_offset_x')} offsetY={numberFor(row, 'portrait_offset_y')}
                      className="w-11 h-11 rounded-md bg-white/5" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={valueFor(row, 'name')} onChange={e => setEdit(row.id, 'name', e.target.value)}
                      className="w-28 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white outline-none" />
                  </td>
                  <td className="px-2 py-1.5 text-white/50 capitalize">{row.primary_type}{row.secondary_type ? ` / ${row.secondary_type}` : ''}</td>
                  {STAT_KEYS.map(k => (
                    <td key={k} className="px-2 py-1.5">
                      <input type="number" value={valueFor(row, k)} onChange={e => setEdit(row.id, k, e.target.value)}
                        className="w-12 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white text-center outline-none" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <input type="number" value={valueFor(row, 'overall_rating')} onChange={e => setEdit(row.id, 'overall_rating', e.target.value)}
                      className="w-14 bg-transparent border-b border-white/10 focus:border-[#00c8ff] text-[#00c8ff] font-bold text-center outline-none" />
                  </td>
                  <td className="px-2 py-1.5 text-center text-white/40">{row.evolution_stage}</td>
                  <td className="px-2 py-1.5">
                    <select value={valueFor(row, 'card_tier_override')} onChange={e => setEdit(row.id, 'card_tier_override', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-md text-[10px] font-bold uppercase text-[#facc15] px-1.5 py-1 outline-none focus:border-[#facc15]">
                      {TIER_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#0d0e14] text-white normal-case">{o.label}</option>)}
                    </select>
                  </td>
                  {PORTRAIT_KEYS.map(k => (
                    <td key={k} className="px-2 py-1.5">
                      <input type="number" step="0.1" value={valueFor(row, k)} onChange={e => setEdit(row.id, k, e.target.value)}
                        className="w-14 bg-transparent border-b border-white/10 focus:border-[#00c8ff] text-white text-center outline-none" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button disabled={!isDirty(row.id) || savingId === row.id} onClick={() => handleSave(row)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isDirty(row.id) ? 'bg-[#9b5cff]/20 text-[#9b5cff] hover:bg-[#9b5cff]/30' : 'text-white/15 cursor-default'}`}>
                      <Save size={11} /> {savingId === row.id ? '...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
