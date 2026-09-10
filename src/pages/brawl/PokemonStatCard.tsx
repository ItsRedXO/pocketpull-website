import React from 'react';
import { motion } from 'framer-motion';
import { PokemonPortrait } from './PokemonPortrait';
import { typeColor } from './typeColors';

export type CardTier = 'bronze' | 'silver' | 'gold' | 'legendary';

export function getCardTier(mon: { overall_rating: number; is_legendary?: number; is_mythical?: number }): CardTier {
  if (mon.is_legendary || mon.is_mythical) return 'legendary';
  if (mon.overall_rating >= 80) return 'gold';
  if (mon.overall_rating >= 65) return 'silver';
  return 'bronze';
}

const TIER_STYLE: Record<CardTier, { bg: string; border: string; glow: string; text: string; statBg: string }> = {
  bronze: { bg: 'linear-gradient(160deg, #8a5a30 0%, #4a2f16 100%)', border: '#c9884f', glow: 'rgba(201,136,79,0.35)', text: '#fdf1e2', statBg: 'rgba(0,0,0,0.28)' },
  silver: { bg: 'linear-gradient(160deg, #e2e7ee 0%, #8b95a3 100%)', border: '#f2f5f9', glow: 'rgba(226,231,238,0.4)', text: '#20232c', statBg: 'rgba(0,0,0,0.12)' },
  gold: { bg: 'linear-gradient(160deg, #ffe38a 0%, #b9861a 100%)', border: '#ffefb8', glow: 'rgba(255,224,130,0.55)', text: '#2a1c00', statBg: 'rgba(0,0,0,0.16)' },
  legendary: { bg: 'linear-gradient(155deg, #5b21c9 0%, #c6389a 55%, #ffbe3d 100%)', border: '#ffd23f', glow: 'rgba(255,150,220,0.6)', text: '#fff', statBg: 'rgba(0,0,0,0.25)' },
};

interface PokemonLike {
  name: string; artwork_url: string | null; primary_type: string; overall_rating: number;
  base_attack: number; base_defense: number; base_hp: number; base_speed: number;
  portrait_scale?: number; portrait_offset_x?: number; portrait_offset_y?: number;
  is_legendary?: number; is_mythical?: number;
}

export function PokemonStatCard({ mon, selected, order, index, onClick, nickname }: {
  mon: PokemonLike; selected?: boolean; order?: number | null; index?: number; onClick?: () => void; nickname?: string | null;
}) {
  const tier = getCardTier(mon);
  const style = TIER_STYLE[tier];
  const isLegendary = tier === 'legendary';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10, scale: 0.92 }}
      animate={isLegendary
        ? { opacity: 1, y: 0, scale: 1, boxShadow: [`0 0 10px ${style.glow}`, `0 0 20px ${style.glow}`, `0 0 10px ${style.glow}`] }
        : { opacity: 1, y: 0, scale: 1 }}
      transition={isLegendary
        ? { opacity: { delay: Math.min(index ?? 0, 12) * 0.02 }, y: { delay: Math.min(index ?? 0, 12) * 0.02 }, boxShadow: { repeat: Infinity, duration: 2.2 } }
        : { delay: Math.min(index ?? 0, 12) * 0.02, type: 'spring', stiffness: 300, damping: 22 }}
      whileHover={{ y: -3, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative rounded-xl overflow-hidden flex flex-col items-center text-left"
      style={{
        background: style.bg,
        border: `2px solid ${selected ? '#00c8ff' : style.border}`,
        boxShadow: selected ? '0 0 16px rgba(0,200,255,0.35)' : (isLegendary ? undefined : `0 0 8px ${style.glow}`),
      }}
    >
      {selected && order != null && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full bg-[#00c8ff] text-black text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0b0f]">
          {order}
        </span>
      )}

      <div className="w-full flex items-center justify-between px-1.5 pt-1.5">
        <span className="text-sm font-black leading-none" style={{ color: style.text }}>{mon.overall_rating}</span>
        <span className="text-[6.5px] px-1 py-0.5 rounded-full uppercase font-bold leading-none" style={{ background: `${typeColor(mon.primary_type)}cc`, color: '#fff' }}>
          {mon.primary_type.slice(0, 3)}
        </span>
      </div>

      <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={mon.portrait_scale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y}
        className="w-14 h-14 -mt-0.5" />

      <div className="text-[10px] font-bold capitalize truncate w-full text-center px-1 leading-tight" style={{ color: style.text }}>
        {nickname || mon.name}
      </div>

      <div className="w-full grid grid-cols-4 mt-1.5" style={{ background: style.statBg }}>
        {[['ATK', mon.base_attack], ['DEF', mon.base_defense], ['HP', mon.base_hp], ['SPD', mon.base_speed]].map(([label, val]) => (
          <div key={label} className="py-1 text-center border-r last:border-r-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            <div className="text-[6px] font-bold uppercase opacity-70 leading-none" style={{ color: style.text }}>{label}</div>
            <div className="text-[9.5px] font-black leading-none mt-0.5" style={{ color: style.text }}>{val}</div>
          </div>
        ))}
      </div>
    </motion.button>
  );
}
