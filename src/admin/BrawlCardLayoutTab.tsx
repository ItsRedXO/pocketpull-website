import React, { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useBrawlCardLayout, DEFAULT_BRAWL_CARD_LAYOUT, type BrawlCardLayout } from '../hooks/useSiteConfig';
import { PokemonStatCard } from '../pages/brawl/PokemonStatCard';

const PREVIEW_MON = {
  name: 'Flareon', artwork_url: null, primary_type: 'fire', overall_rating: 72,
  base_attack: 83, base_defense: 41, base_hp: 44, base_speed: 44,
  is_legendary: 0, is_mythical: 0,
};

interface SliderRowProps {
  label: string; sub: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}
function SliderRow({ label, sub, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-44 shrink-0">
        <div className="text-xs font-bold text-white">{label}</div>
        <div className="text-[10px] text-white/40">{sub}</div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#9b5cff]" />
      <span className="w-10 text-right text-xs font-mono text-white/70">{value}</span>
    </div>
  );
}

export function BrawlCardLayoutTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const { layout: saved, saveLayout, isSaving } = useBrawlCardLayout();
  const [draft, setDraft] = useState<BrawlCardLayout>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => { setDraft(saved); }, [saved]);

  const set = (k: keyof BrawlCardLayout) => (v: number) => setDraft(d => ({ ...d, [k]: v }));

  const handleSave = async () => {
    try { await saveLayout(draft); showToast('Card layout saved', true); }
    catch { showToast('Failed to save', false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Controls */}
      <div className="flex-1 space-y-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-display uppercase tracking-widest text-white/70">Card Layout</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setDraft(DEFAULT_BRAWL_CARD_LAYOUT)}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white">
              <RotateCcw size={12} /> Reset
            </button>
            <button disabled={!dirty || isSaving} onClick={handleSave}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg ${dirty ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black' : 'bg-white/5 text-white/30'}`}>
              <Save size={12} /> {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <SliderRow label="Frame Scale" sub="How much the card frame fills its cell (default 1.16)"
          value={draft.scale} min={1.0} max={1.6} step={0.01} onChange={set('scale')} />

        <SliderRow label="Stats Y Position" sub="Top % where the stats row starts in the frame (default 79.5)"
          value={draft.statsTop} min={70} max={88} step={0.5} onChange={set('statsTop')} />

        <SliderRow label="Stats Height" sub="Height % of the stats row in the frame (default 9.3)"
          value={draft.statsHeight} min={5} max={16} step={0.5} onChange={set('statsHeight')} />

        <SliderRow label="Team Grid Columns" sub="Cards per row in Active Team on desktop (default 4)"
          value={draft.teamCols} min={3} max={6} step={1} onChange={set('teamCols')} />

        <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/40 space-y-1">
          <p>Changes apply site-wide immediately after Save.</p>
          <p>Stats Y + Height: tune these so the numbers sit inside the baked stats slot on the card frame art.</p>
          <p>Frame Scale: pushes the frame border to card edges. Below 1.0 shows transparent glow margins.</p>
        </div>
      </div>

      {/* Live preview */}
      <div className="w-48 shrink-0">
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Live Preview</div>
        <PokemonStatCard mon={PREVIEW_MON} layout={draft} />
      </div>
    </div>
  );
}
