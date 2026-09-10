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

const SHINE = 'linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 32%)';
const TIER_STYLE: Record<CardTier, { bg: string; border: string; glow: string; text: string; subtext: string; statBg: string; labelColor: string }> = {
  bronze: { bg: `${SHINE}, linear-gradient(160deg, #9a6a3c 0%, #5c3a1c 55%, #3a230f 100%)`, border: '#d9995c', glow: 'rgba(217,153,92,0.4)', text: '#fff8ef', subtext: '#e8c39a', statBg: 'rgba(0,0,0,0.32)', labelColor: '#e8c39a' },
  silver: { bg: `${SHINE}, linear-gradient(160deg, #eef1f5 0%, #c2c9d3 45%, #8b95a3 100%)`, border: '#ffffff', glow: 'rgba(226,231,238,0.5)', text: '#1a1d24', subtext: '#4b5563', statBg: 'rgba(0,0,0,0.1)', labelColor: '#4b5563' },
  gold: { bg: `${SHINE}, linear-gradient(160deg, #ffe9a3 0%, #f0b93d 45%, #ad7511 100%)`, border: '#ffe38a', glow: 'rgba(255,224,130,0.6)', text: '#2a1c00', subtext: '#6b4a0c', statBg: 'rgba(0,0,0,0.14)', labelColor: '#6b4a0c' },
  legendary: { bg: `${SHINE}, linear-gradient(155deg, #6a2bd9 0%, #d63aa5 50%, #ffbe3d 100%)`, border: '#ffd23f', glow: 'rgba(255,150,220,0.65)', text: '#fff', subtext: 'rgba(255,255,255,0.85)', statBg: 'rgba(0,0,0,0.28)', labelColor: 'rgba(255,255,255,0.8)' },
};
const TIER_LABEL: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legendary' };

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
        background: style.bg,
        border: `3px solid ${selected ? '#00c8ff' : style.border}`,
        boxShadow: selected ? '0 0 18px rgba(0,200,255,0.4)' : (isLegendary ? undefined : `0 4px 14px rgba(0,0,0,0.35), 0 0 10px ${style.glow}`),
      }}
    >
      {selected && order != null && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full bg-[#00c8ff] text-black text-xs font-black flex items-center justify-center border-2 border-[#0a0b0f] shadow">
          {order}
        </span>
      )}

      <div className="w-full flex items-center justify-between px-2.5 pt-2.5">
        <span className="text-2xl font-black leading-none tracking-tight" style={{ color: style.text }}>{mon.overall_rating}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-extrabold leading-none tracking-wide" style={{ background: `${typeColor(mon.primary_type)}dd`, color: '#fff' }}>
          {mon.primary_type.slice(0, 3)}
        </span>
      </div>

      <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={mon.portrait_scale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y}
        className="w-24 h-24 mt-0.5" />

      <div className="text-base font-extrabold capitalize truncate w-full text-center px-2 leading-tight" style={{ color: style.text }}>
        {nickname || mon.name}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: style.subtext }}>
        {TIER_LABEL[tier]}
      </div>

      <div className="w-full grid grid-cols-4 border-t" style={{ background: style.statBg, borderColor: 'rgba(0,0,0,0.25)' }}>
        {[['ATK', mon.base_attack], ['DEF', mon.base_defense], ['HP', mon.base_hp], ['SPD', mon.base_speed]].map(([label, val]) => (
          <div key={label} className="py-2 text-center border-r last:border-r-0" style={{ borderColor: 'rgba(0,0,0,0.2)' }}>
            <div className="text-[8px] font-extrabold uppercase tracking-wide leading-none" style={{ color: style.labelColor }}>{label}</div>
            <div className="text-sm font-black leading-none mt-1" style={{ color: style.text }}>{val}</div>
          </div>
        ))}
      </div>
    </motion.button>
  );
}
