import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { PokemonPortrait } from './PokemonPortrait';
import { typeColor } from './typeColors';
import { typeBackground } from './typeBackgrounds';
import { CARD_FRAMES } from './cardFrames';
import type { BrawlCardLayout, BrawlTierLayouts, CardTier } from '../../hooks/useSiteConfig';
import { DEFAULT_BRAWL_CARD_LAYOUT } from '../../hooks/useSiteConfig';

export type { CardTier };

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

// Border/glow now live in the frame artwork itself (see cardFrames.ts), so
// tier only needs an accent color for the small bits of text we still draw
// ourselves (stat labels) and the legendary pulse glow.
const TIER_ACCENT: Record<CardTier, string> = { bronze: '#e8c39a', silver: '#e5e7eb', gold: '#ffd76a', legendary: '#ff5c5c' };
const TIER_LABEL: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legendary' };

interface PokemonLike {
  name: string; artwork_url: string | null; primary_type: string; overall_rating: number;
  base_attack: number; base_defense: number; base_hp: number; base_speed: number;
  portrait_scale?: number; portrait_offset_x?: number; portrait_offset_y?: number;
  is_legendary?: number; is_mythical?: number; star_level?: number; card_tier_override?: string | null;
}

// Non-configurable size/shape parts of each overlay region.
// Positions (top/left) come from BrawlCardLayout so they can be tuned in
// the admin panel without a redeploy.
const LAYOUT = {
  power: { width: '30%', height: '7%' },
  type:  { width: '19%', height: '8.5%' },
  name:  { left: '3%',  width: '94%', height: '7%' },
};

export function PokemonStatCard({ mon, selected, order, index, onClick, nickname, count, layout: layoutProp, layouts }: {
  mon: PokemonLike; selected?: boolean; order?: number | null; index?: number; onClick?: () => void; nickname?: string | null; count?: number;
  layout?: Partial<BrawlCardLayout>;
  layouts?: BrawlTierLayouts;
}) {
  const tier = getCardTier(mon);
  const layout = { ...DEFAULT_BRAWL_CARD_LAYOUT, ...(layouts ? layouts[tier] : {}), ...(layoutProp ?? {}) };
  const statsLayout = { top: `${layout.statsTop}%`, left: '8.5%', width: '83%', height: `${layout.statsHeight}%` };
  const accent = TIER_ACCENT[tier];
  const isLegendary = tier === 'legendary';
  const selectionGlow = selected ? 'drop-shadow(0 0 2px #00c8ff) drop-shadow(0 0 9px rgba(0,200,255,0.85))' : '';
  const portraitScale = Math.max(1, (mon.portrait_scale ?? 1.5) * 0.8);

  return (
    <div className="relative w-full">
      <div style={{ paddingTop: '150%' }} />
      <motion.button
        initial={{ opacity: 0, y: 10, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: Math.min(index ?? 0, 12) * 0.02, type: 'spring', stiffness: 300, damping: 22 }}
        whileHover={{ y: -4, scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        aria-label={`${nickname || mon.name}, ${TIER_LABEL[tier]} tier, power ${mon.overall_rating}`}
        className="absolute inset-0 w-full h-full text-left"
      >
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '5%' }}>
          <img src={typeBackground(mon.primary_type)} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 35%' }} />
        </div>

        <div className="absolute inset-0" style={{ transform: `scale(${layout.scale})`, transformOrigin: 'center' }}>
          <div className="absolute" style={{ top: `${layout.windowTop}%`, left: `${layout.windowLeft}%`, right: `${layout.windowRight}%`, bottom: `${layout.windowBottom}%` }}>
            <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={portraitScale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y}
              className="w-full h-full" />
          </div>

          <motion.img
            src={CARD_FRAMES[tier]} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            style={{ zIndex: 2 }}
            animate={isLegendary
              ? { filter: [
                  `drop-shadow(0 0 6px rgba(255,92,92,0.55))${selectionGlow ? ' ' + selectionGlow : ''}`,
                  `drop-shadow(0 0 16px rgba(255,92,92,0.9))${selectionGlow ? ' ' + selectionGlow : ''}`,
                  `drop-shadow(0 0 6px rgba(255,92,92,0.55))${selectionGlow ? ' ' + selectionGlow : ''}`,
                ] }
              : { filter: selectionGlow || 'none' }}
            transition={isLegendary ? { repeat: Infinity, duration: 2.2 } : { duration: 0.15 }}
          />

          <div className="absolute flex items-center justify-center" style={{ top: `${layout.powerTop}%`, left: `${layout.powerLeft}%`, ...LAYOUT.power, zIndex: 3 }}>
            <span className="font-black leading-none text-white" style={{ fontSize: layout.powerSize, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{mon.overall_rating}</span>
          </div>

          <div className="absolute flex items-center justify-center" style={{ top: `${layout.typeTop}%`, left: `${layout.typeLeft}%`, ...LAYOUT.type, zIndex: 3 }}>
            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full uppercase font-extrabold leading-none tracking-wide text-white" style={{ background: `${typeColor(mon.primary_type)}e6` }}>
              {mon.primary_type.slice(0, 3)}
            </span>
          </div>

          <div className="absolute flex items-center justify-center gap-1 px-2" style={{ top: `${layout.nameTop}%`, ...LAYOUT.name, zIndex: 3 }}>
            <span className="font-extrabold capitalize truncate text-white" style={{ fontSize: layout.nameSize, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
              {nickname || mon.name}
            </span>
            {!!count && count > 1 && <span className="text-xs font-bold text-white/70 shrink-0">(×{count})</span>}
            {!!mon.star_level && (
              <span className="flex items-center gap-px shrink-0">
                {Array.from({ length: mon.star_level }, (_, i) => <Star key={i} size={9} fill="#facc15" className="text-[#facc15]" />)}
              </span>
            )}
          </div>

          <div className="absolute grid grid-cols-4" style={{ ...statsLayout, zIndex: 3 }}>
            {[mon.base_attack, mon.base_defense, mon.base_hp, mon.base_speed].map((val, i) => (
              <div key={i} className="flex items-center justify-center">
                <div className="font-black leading-none text-white" style={{ fontSize: layout.statsFontSize }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {selected && order != null && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full bg-[#00c8ff] text-black text-xs font-black flex items-center justify-center border-2 border-[#0a0b0f] shadow">
            {order}
          </span>
        )}
      </motion.button>
    </div>
  );
}
