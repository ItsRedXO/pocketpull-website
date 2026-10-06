import React, { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useBrawlCardLayout, DEFAULT_BRAWL_CARD_LAYOUT, type BrawlCardLayout } from '../hooks/useSiteConfig';
import { PokemonStatCard, type CardTier } from '../pages/brawl/PokemonStatCard';

const PREVIEW_MONS: Record<CardTier, React.ComponentProps<typeof PokemonStatCard>['mon']> = {
  bronze:    { name: 'Rattata',   artwork_url: null, primary_type: 'normal', overall_rating: 28, base_attack: 56, base_defense: 35, base_hp: 30,  base_speed: 72, is_legendary: 0, is_mythical: 0, card_tier_override: 'bronze' },
  silver:    { name: 'Wartortle', artwork_url: null, primary_type: 'water',  overall_rating: 55, base_attack: 63, base_defense: 80, base_hp: 59,  base_speed: 58, is_legendary: 0, is_mythical: 0, card_tier_override: 'silver' },
  gold:      { name: 'Flareon',   artwork_url: null, primary_type: 'fire',   overall_rating: 72, base_attack: 83, base_defense: 60, base_hp: 65,  base_speed: 65, is_legendary: 0, is_mythical: 0, card_tier_override: 'gold' },
  legendary: { name: 'Dragonite', artwork_url: null, primary_type: 'dragon', overall_rating: 84, base_attack: 134,base_defense: 95, base_hp: 91,  base_speed: 80, is_legendary: 0, is_mythical: 0, card_tier_override: 'legendary' },
};

const TIER_LABEL: Record<CardTier, string> = { bronze: 'BRZ', silver: 'SLV', gold: 'GLD', legendary: 'LEG' };
const TIER_COLOR: Record<CardTier, string> = { bronze: '#e8c39a', silver: '#e5e7eb', gold: '#ffd76a', legendary: '#ff5c5c' };
const TIERS: CardTier[] = ['bronze', 'silver', 'gold', 'legendary'];

interface SliderRowProps {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}
function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 text-xs font-medium text-white/70">{label}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#9b5cff] h-1" />
      <span className="w-8 text-right text-xs font-mono text-white/50">{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/8 pb-1">{children}</div>
    </div>
  );
}

export function BrawlCardLayoutTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const { layout: saved, saveLayout, isSaving } = useBrawlCardLayout();
  const [draft, setDraft] = useState<BrawlCardLayout>(saved);
  const [previewTier, setPreviewTier] = useState<CardTier>('gold');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => { setDraft(saved); }, [saved]);

  const set = (k: keyof BrawlCardLayout) => (v: number) => setDraft(d => ({ ...d, [k]: v }));

  const handleSave = async () => {
    try { await saveLayout(draft); showToast('Card layout saved', true); }
    catch { showToast('Failed to save', false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* ── Controls ── */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '78vh' }}>
        <div className="flex items-center justify-between mb-3 sticky top-0 z-10 py-1" style={{ background: 'rgba(10,11,15,0.95)' }}>
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

        <div className="space-y-2 pr-2">
          <SectionHeader>Frame</SectionHeader>
          <SliderRow label="Scale" value={draft.scale} min={1.0} max={1.6} step={0.01} onChange={set('scale')} />

          <SectionHeader>Artwork Window</SectionHeader>
          <SliderRow label="Top %" value={draft.windowTop} min={0} max={40} step={0.5} onChange={set('windowTop')} />
          <SliderRow label="Left %" value={draft.windowLeft} min={0} max={30} step={0.5} onChange={set('windowLeft')} />
          <SliderRow label="Right %" value={draft.windowRight} min={0} max={30} step={0.5} onChange={set('windowRight')} />
          <SliderRow label="Bottom %" value={draft.windowBottom} min={20} max={60} step={0.5} onChange={set('windowBottom')} />

          <SectionHeader>Name</SectionHeader>
          <SliderRow label="Vertical %" value={draft.nameTop} min={40} max={85} step={0.5} onChange={set('nameTop')} />
          <SliderRow label="Font Size px" value={draft.nameSize} min={8} max={28} step={1} onChange={set('nameSize')} />

          <SectionHeader>Power Badge</SectionHeader>
          <SliderRow label="Vertical %" value={draft.powerTop} min={0} max={30} step={0.5} onChange={set('powerTop')} />
          <SliderRow label="Horizontal %" value={draft.powerLeft} min={0} max={30} step={0.5} onChange={set('powerLeft')} />
          <SliderRow label="Font Size px" value={draft.powerSize} min={10} max={40} step={1} onChange={set('powerSize')} />

          <SectionHeader>Type Badge</SectionHeader>
          <SliderRow label="Vertical %" value={draft.typeTop} min={0} max={30} step={0.5} onChange={set('typeTop')} />
          <SliderRow label="Horizontal %" value={draft.typeLeft} min={50} max={90} step={0.5} onChange={set('typeLeft')} />

          <SectionHeader>Stats Row</SectionHeader>
          <SliderRow label="Top %" value={draft.statsTop} min={74} max={95} step={0.5} onChange={set('statsTop')} />
          <SliderRow label="Height %" value={draft.statsHeight} min={4} max={20} step={0.5} onChange={set('statsHeight')} />
          <SliderRow label="Font Size px" value={draft.statsFontSize} min={7} max={20} step={1} onChange={set('statsFontSize')} />

          <SectionHeader>Grid</SectionHeader>
          <SliderRow label="Team Columns" value={draft.teamCols} min={3} max={6} step={1} onChange={set('teamCols')} />
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="w-52 shrink-0 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-white/40">Live Preview</div>

        {/* Tier switcher */}
        <div className="grid grid-cols-4 gap-1">
          {TIERS.map(tier => (
            <button key={tier} onClick={() => setPreviewTier(tier)}
              className="py-1.5 rounded text-[9px] font-bold uppercase transition-all"
              style={{
                color: TIER_COLOR[tier],
                border: `1px solid ${TIER_COLOR[tier]}${previewTier === tier ? 'cc' : '33'}`,
                background: previewTier === tier ? `${TIER_COLOR[tier]}22` : 'transparent',
                opacity: previewTier === tier ? 1 : 0.45,
              }}>
              {TIER_LABEL[tier]}
            </button>
          ))}
        </div>

        {/* Pokemon label */}
        <div className="text-center text-[11px] font-bold capitalize" style={{ color: TIER_COLOR[previewTier] }}>
          {PREVIEW_MONS[previewTier].name}
          <span className="ml-1 text-[9px] text-white/30 font-normal">· {PREVIEW_MONS[previewTier].primary_type}</span>
        </div>

        {/* Card */}
        <PokemonStatCard mon={PREVIEW_MONS[previewTier]} layout={draft} />
      </div>
    </div>
  );
}
