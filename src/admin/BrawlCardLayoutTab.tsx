import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, SaveAll } from 'lucide-react';
import {
  useBrawlTierLayouts,
  DEFAULT_BRAWL_CARD_LAYOUT, DEFAULT_BRAWL_TIER_LAYOUTS,
  type BrawlCardLayout, type BrawlTierLayouts, type CardTier,
} from '../hooks/useSiteConfig';
import { PokemonStatCard } from '../pages/brawl/PokemonStatCard';

const PREVIEW_MONS: Record<CardTier, React.ComponentProps<typeof PokemonStatCard>['mon']> = {
  bronze:    { name: 'Rattata',   artwork_url: null, primary_type: 'normal', overall_rating: 28,  base_attack: 56,  base_defense: 35, base_hp: 30, base_speed: 72, is_legendary: 0, is_mythical: 0, card_tier_override: 'bronze' },
  silver:    { name: 'Wartortle', artwork_url: null, primary_type: 'water',  overall_rating: 55,  base_attack: 63,  base_defense: 80, base_hp: 59, base_speed: 58, is_legendary: 0, is_mythical: 0, card_tier_override: 'silver' },
  gold:      { name: 'Flareon',   artwork_url: null, primary_type: 'fire',   overall_rating: 72,  base_attack: 83,  base_defense: 60, base_hp: 65, base_speed: 65, is_legendary: 0, is_mythical: 0, card_tier_override: 'gold' },
  legendary: { name: 'Dragonite', artwork_url: null, primary_type: 'dragon', overall_rating: 84,  base_attack: 134, base_defense: 95, base_hp: 91, base_speed: 80, is_legendary: 0, is_mythical: 0, card_tier_override: 'legendary' },
};

const TIER_LABEL: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legend' };
const TIER_SHORT: Record<CardTier, string> = { bronze: 'BRZ', silver: 'SLV', gold: 'GLD', legendary: 'LEG' };
const TIER_COLOR: Record<CardTier, string> = { bronze: '#e8c39a', silver: '#e5e7eb', gold: '#ffd76a', legendary: '#ff5c5c' };
const TIERS: CardTier[] = ['bronze', 'silver', 'gold', 'legendary'];

interface SliderRowProps { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; }
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
  const { layouts: saved, saveLayouts, isSaving } = useBrawlTierLayouts();
  const [drafts, setDrafts] = useState<BrawlTierLayouts>(saved);
  const [tier, setTier] = useState<CardTier>('gold');

  useEffect(() => { setDrafts(saved); }, [saved]);

  const draft = drafts[tier];
  const set = (k: keyof BrawlCardLayout) => (v: number) =>
    setDrafts(prev => ({ ...prev, [tier]: { ...prev[tier], [k]: v } }));
  const resetTier = () =>
    setDrafts(prev => ({ ...prev, [tier]: { ...DEFAULT_BRAWL_CARD_LAYOUT } }));

  const isDirty = (t: CardTier) => JSON.stringify(drafts[t]) !== JSON.stringify(saved[t]);
  const dirtyTiers = TIERS.filter(isDirty);

  const handleSave = async () => {
    try {
      await saveLayouts({ ...saved, [tier]: drafts[tier] });
      showToast(`${TIER_LABEL[tier]} layout saved`, true);
    } catch { showToast('Failed to save', false); }
  };

  const handleSaveAll = async () => {
    try {
      await saveLayouts(drafts);
      showToast('All layouts saved', true);
    } catch { showToast('Failed to save', false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* â”€â”€ Controls â”€â”€ */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '78vh' }}>
        {/* Sticky header */}
        <div className="flex items-center justify-between mb-3 sticky top-0 z-10 py-1" style={{ background: 'rgba(10,11,15,0.95)' }}>
          <h3 className="text-sm font-sans uppercase tracking-widest text-white/70">Card Layout</h3>
          <div className="flex items-center gap-2">
            <button onClick={resetTier}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white">
              <RotateCcw size={12} /> Reset
            </button>
            {dirtyTiers.length > 1 && (
              <button disabled={isSaving} onClick={handleSaveAll}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg bg-white/10 border border-white/20 text-white/70 hover:text-white">
                <SaveAll size={12} /> Save All
              </button>
            )}
            <button disabled={!isDirty(tier) || isSaving} onClick={handleSave}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg ${isDirty(tier) ? 'text-black' : 'bg-white/5 text-white/30'}`}
              style={isDirty(tier) ? { background: TIER_COLOR[tier] } : {}}>
              <Save size={12} /> {isSaving ? 'Savingâ€¦' : `Save ${TIER_SHORT[tier]}`}
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
          <p className="text-[10px] text-white/20 pl-1">Team grid columns are read from the Gold tier setting.</p>
        </div>
      </div>

      {/* â”€â”€ Preview â”€â”€ */}
      <div className="w-52 shrink-0 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-white/40">Live Preview</div>

        {/* Tier switcher */}
        <div className="grid grid-cols-4 gap-1">
          {TIERS.map(t => (
            <button key={t} onClick={() => setTier(t)}
              className="relative py-1.5 rounded text-[9px] font-bold uppercase transition-all"
              style={{
                color: TIER_COLOR[t],
                border: `1px solid ${TIER_COLOR[t]}${tier === t ? 'cc' : '33'}`,
                background: tier === t ? `${TIER_COLOR[t]}22` : 'transparent',
                opacity: tier === t ? 1 : 0.5,
              }}>
              {TIER_SHORT[t]}
              {isDirty(t) && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: TIER_COLOR[t] }} />
              )}
            </button>
          ))}
        </div>

        {/* Pokemon label */}
        <div className="text-center text-[11px] font-bold capitalize" style={{ color: TIER_COLOR[tier] }}>
          {PREVIEW_MONS[tier].name}
          <span className="ml-1 text-[9px] text-white/30 font-normal">Â· {PREVIEW_MONS[tier].primary_type}</span>
        </div>

        {/* Card */}
        <PokemonStatCard mon={PREVIEW_MONS[tier]} layout={draft} />

        {/* Unsaved tiers summary */}
        {dirtyTiers.length > 0 && (
          <div className="text-[9px] text-white/30 text-center space-y-0.5">
            <div>Unsaved:</div>
            <div className="flex gap-1 justify-center flex-wrap">
              {dirtyTiers.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase" style={{ color: TIER_COLOR[t], background: `${TIER_COLOR[t]}22` }}>
                  {TIER_SHORT[t]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
