import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { PokemonPortrait } from './PokemonPortrait';
import { typeColor } from './typeColors';
import { typeBackground } from './typeBackgrounds';

export type CardTier = 'bronze' | 'silver' | 'gold' | 'legendary';

// Bronze 0-49 / Silver 50-65 / Gold 66-80 / Legendary 81-100 -- a straight
// read of overall_rating now that computeOverallRating (see rating.ts) is a
// weighted composite leaning on a species' best stats instead of a flat
// average, so genuine standouts can actually reach the 80s-90s. A real
// Legendary/Mythical is still always Legendary tier even if its stat roll
// lands below 81 (an accurate but mediocre-stat legendary is still a
// legendary) -- the rating threshold is an OR on top of that flag, not a
// replacement for it, so non-legendary species can earn their way in too.
export function getCardTier(mon: { overall_rating: number; is_legendary?: number; is_mythical?: number; card_tier_override?: string | null }): CardTier {
  if (mon.card_tier_override === 'bronze' || mon.card_tier_override === 'silver' || mon.card_tier_override === 'gold' || mon.card_tier_override === 'legendary') {
    return mon.card_tier_override;
  }
  if (mon.is_legendary || mon.is_mythical || mon.overall_rating >= 81) return 'legendary';
  if (mon.overall_rating >= 66) return 'gold';
  if (mon.overall_rating >= 50) return 'silver';
  return 'bronze';
}

// The card's interior is now a photographic type background (see
// typeBackgrounds.ts) instead of a flat tier gradient, so tier only drives
// the frame: border color, glow, and the small tier-label/archetype accent
// color. `accent` is picked to stay legible over the dark scrim we lay on
// top of every background image, unlike the old per-tier dark/light text.
const TIER_STYLE: Record<CardTier, { border: string; glow: string; accent: string }> = {
  bronze: { border: '#d9995c', glow: 'rgba(217,153,92,0.4)', accent: '#e8c39a' },
  silver: { border: '#ffffff', glow: 'rgba(226,231,238,0.5)', accent: '#e5e7eb' },
  gold: { border: '#ffe38a', glow: 'rgba(255,224,130,0.6)', accent: '#ffd76a' },
  legendary: { border: '#ffd23f', glow: 'rgba(255,150,220,0.65)', accent: '#ffd23f' },
};
const TIER_LABEL: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legendary' };

interface PokemonLike {
  name: string; artwork_url: string | null; primary_type: string; overall_rating: number;
  base_attack: number; base_defense: number; base_hp: number; base_speed: number;
  base_sp_attack?: number; base_sp_defense?: number;
  portrait_scale?: number; portrait_offset_x?: number; portrait_offset_y?: number;
  is_legendary?: number; is_mythical?: number; star_level?: number; card_tier_override?: string | null;
}

// Purely a cosmetic label derived from real base stats -- there's no
// archetype field in the data model, so this reads the stat spread instead
// of inventing new persisted state.
function getArchetype(mon: PokemonLike): string {
  const { base_attack: atk, base_defense: def, base_hp: hp, base_speed: spd } = mon;
  const spAtk = mon.base_sp_attack ?? atk;
  const spDef = mon.base_sp_defense ?? def;
  const total = atk + def + hp + spd || 1;
  if (spd / total >= 0.32) return 'Speedster';
  if (hp / total >= 0.34) return 'Tank';
  if (def / total >= 0.32 && def >= atk) return 'Defender';
  if (atk / total >= 0.34 && def / total <= 0.18) return 'Glass Cannon';
  if (spAtk > atk && spDef >= def) return 'Support';
  if (atk >= def * 1.15 && def / total >= 0.2) return 'Bruiser';
  if (atk > def) return 'Offensive';
  return 'Balanced';
}

export function PokemonStatCard({ mon, selected, order, index, onClick, nickname, count }: {
  mon: PokemonLike; selected?: boolean; order?: number | null; index?: number; onClick?: () => void; nickname?: string | null; count?: number;
}) {
  const tier = getCardTier(mon);
  const style = TIER_STYLE[tier];
  const isLegendary = tier === 'legendary';
  // Trimmed down from the raw per-species crop so the full sprite clears the
  // card's edges at this size -- the untrimmed scale was tuned for smaller
  // thumbnails elsewhere and clips heads/feet when blown up this large.
  const portraitScale = Math.max(1, (mon.portrait_scale ?? 1.5) * 0.8);

  return (
    // The order badge sits partly above the card's own top edge (-top-2), so
    // it lives in this unclipped wrapper as a sibling of the button rather
    // than inside it -- the button needs overflow-hidden itself (for its
    // rounded corners/shine gradient), which was clipping the badge's top.
    <div className="relative w-full">
      <motion.button
        layout
        initial={{ opacity: 0, y: 10, scale: 0.92 }}
        animate={isLegendary
          ? { opacity: 1, y: 0, scale: 1, boxShadow: [`0 4px 14px rgba(0,0,0,0.4), 0 0 10px ${style.glow}`, `0 4px 14px rgba(0,0,0,0.4), 0 0 22px ${style.glow}`, `0 4px 14px rgba(0,0,0,0.4), 0 0 10px ${style.glow}`] }
          : { opacity: 1, y: 0, scale: 1 }}
        transition={isLegendary
          ? { opacity: { delay: Math.min(index ?? 0, 12) * 0.02 }, y: { delay: Math.min(index ?? 0, 12) * 0.02 }, boxShadow: { repeat: Infinity, duration: 2.2 } }
          : { delay: Math.min(index ?? 0, 12) * 0.02, type: 'spring', stiffness: 300, damping: 22 }}
        whileHover={{ y: -4, scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        className="relative rounded-2xl overflow-hidden flex flex-col items-center text-left w-full"
        style={{
          border: `3px solid ${selected ? '#00c8ff' : style.border}`,
          boxShadow: selected ? '0 0 18px rgba(0,200,255,0.4)' : (isLegendary ? undefined : `0 4px 14px rgba(0,0,0,0.35), 0 0 10px ${style.glow}`),
        }}
      >
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Scaled up so only a cropped, less-detailed slice of the landscape
              shows -- at 1:1 the source art is busy enough to compete with
              the Pokemon sitting on top of it, which should stay the focus. */}
          <img src={typeBackground(mon.primary_type)} alt="" aria-hidden className="w-full h-full object-cover" style={{ transform: 'scale(1.6)', transformOrigin: 'center 35%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,11,15,0.4) 0%, rgba(10,11,15,0.35) 40%, rgba(10,11,15,0.55) 65%, rgba(10,11,15,0.88) 100%)' }} />
        </div>

        <div className="relative z-10 w-full flex items-center justify-between px-2.5 pt-2.5">
          <span className="text-2xl font-black leading-none tracking-tight text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{mon.overall_rating}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-extrabold leading-none tracking-wide" style={{ background: `${typeColor(mon.primary_type)}dd`, color: '#fff' }}>
            {mon.primary_type.slice(0, 3)}
          </span>
        </div>

        <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={portraitScale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y}
          className="relative z-10 w-20 h-24 mt-1.5" />

        <div className="relative z-10 text-base font-extrabold capitalize truncate w-full text-center px-2 leading-tight mt-1 text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          {nickname || mon.name}
          {!!count && count > 1 && <span className="ml-1 font-bold opacity-70">(×{count})</span>}
        </div>
        <div className="relative z-10 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: style.accent }}>
          {TIER_LABEL[tier]}
          {!!mon.star_level && (
            <span className="flex items-center gap-px ml-0.5">
              {Array.from({ length: mon.star_level }, (_, i) => <Star key={i} size={8} fill="#facc15" className="text-[#facc15]" />)}
            </span>
          )}
        </div>
        <div className="relative z-10 mb-2 mt-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wide leading-none border"
          style={{ background: 'rgba(0,0,0,0.4)', color: style.accent, borderColor: style.accent }}>
          {getArchetype(mon)}
        </div>

        <div className="relative z-10 w-full grid grid-cols-4 border-t" style={{ background: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' }}>
          {[['ATK', mon.base_attack], ['DEF', mon.base_defense], ['HP', mon.base_hp], ['SPD', mon.base_speed]].map(([label, val]) => (
            <div key={label} className="py-2 text-center border-r last:border-r-0" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              <div className="text-[8px] font-extrabold uppercase tracking-wide leading-none text-white/60">{label}</div>
              <div className="text-sm font-black leading-none mt-1 text-white">{val}</div>
            </div>
          ))}
        </div>
      </motion.button>

      {selected && order != null && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full bg-[#00c8ff] text-black text-xs font-black flex items-center justify-center border-2 border-[#0a0b0f] shadow">
          {order}
        </span>
      )}
    </div>
  );
}
