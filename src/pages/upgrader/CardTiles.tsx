import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RARITY_COLOR, RARITY_LABEL, InventoryRow, TargetCard } from './constants';

// ── Rarity badge ────────────────────────────────────────────────────────────────
function RarityBadge({ rarity }: { rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af';
  return (
    <div className="flex items-center justify-center gap-1 mt-0.5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>
        {RARITY_LABEL[rarity] ?? rarity}
      </span>
    </div>
  );
}

// ── Card image with elegant fallback ─────────────────────────────────────────────
function CardImage({
  src, alt, emoji, height = 100,
}: { src?: string | null; alt: string; emoji: string; height?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-full object-contain rounded-lg"
        style={{ height, maxHeight: height }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="relative w-full flex items-center justify-center rounded-lg overflow-hidden"
      style={{ height, background: 'rgba(255,255,255,0.04)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#00c8ff]/10 to-[#9b5cff]/10" />
      <span className="text-2xl z-10">{emoji}</span>
    </div>
  );
}

// ── Inventory card tile ──────────────────────────────────────────────────────────
export function InvCardTile({
  card, selected, qty, onClick,
}: {
  card: InventoryRow; selected: boolean; qty: number; onClick: () => void;
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af';

  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative w-full rounded-xl p-2 text-left cursor-pointer overflow-hidden transition-shadow duration-200"
      style={{
        background: selected ? `${color}18` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${selected ? color : color + '35'}`,
        boxShadow: selected
          ? `0 0 22px -4px ${color}80, inset 0 0 20px -12px ${color}30`
          : `0 0 0 0 transparent`,
      }}
      animate={{
        boxShadow: selected
          ? `0 0 22px -4px ${color}80, inset 0 0 20px -12px ${color}30`
          : `0 0 0 0 transparent`,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Selected check badge */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10 shadow-lg"
          style={{ background: '#00c8ff', boxShadow: '0 0 10px -2px #00c8ff80' }}
        >
          <span className="text-[9px] text-black font-black">✓</span>
        </motion.div>
      )}

      {/* Qty badge */}
      {qty > 1 && !selected && (
        <div
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black z-10 shadow-md"
          style={{ background: color }}
        >
          {qty}
        </div>
      )}

      {/* Hover rarity glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 rounded-xl"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}15, transparent 70%)` }}
      />

      {/* Card image */}
      <CardImage
        src={card.cardImageUrl}
        alt={card.cardName}
        emoji={card.emoji}
        height={88}
      />

      {/* Card info */}
      <div className="mt-2 space-y-0.5">
        <p className="text-[10px] font-bold text-center leading-tight text-white line-clamp-2 min-h-[1.75rem]">
          {card.cardName}
        </p>
        <RarityBadge rarity={card.rarity} />
        <p className="text-sm font-display font-bold text-center mt-1" style={{ color: '#fbbf24' }}>
          ${Number(card.value).toFixed(2)}
        </p>
      </div>
    </motion.button>
  );
}

// ── Target card tile ─────────────────────────────────────────────────────────────
export function TargetCardTile({
  card, selected, onClick,
}: {
  card: TargetCard; selected: boolean; onClick: () => void;
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af';

  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative w-full rounded-xl p-2 text-left cursor-pointer overflow-hidden transition-shadow duration-200"
      style={{
        background: selected ? `${color}18` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${selected ? color : color + '35'}`,
        boxShadow: selected
          ? `0 0 22px -4px ${color}80, inset 0 0 20px -12px ${color}30`
          : `0 0 0 0 transparent`,
      }}
    >
      {/* Selected check */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10 shadow-lg"
          style={{ background: color, boxShadow: `0 0 10px -2px ${color}80` }}
        >
          <span className="text-[9px] text-black font-black">✓</span>
        </motion.div>
      )}

      {/* Rarity top-glow */}
      <div
        className="absolute top-0 left-0 right-0 h-8 pointer-events-none rounded-t-xl"
        style={{
          background: `linear-gradient(180deg, ${color}20, transparent)`,
          opacity: selected ? 1 : 0.5,
        }}
      />

      {/* Card image */}
      <CardImage
        src={card.cardImageUrl}
        alt={card.name}
        emoji={card.emoji}
        height={88}
      />

      {/* Card info */}
      <div className="mt-2 space-y-0.5">
        <p className="text-[10px] font-bold text-center leading-tight text-white line-clamp-2 min-h-[1.75rem]">
          {card.name}
        </p>
        <RarityBadge rarity={card.rarity} />
        <p className="text-sm font-display font-bold text-center mt-1" style={{ color: '#fbbf24' }}>
          ${card.value.toFixed(2)}
        </p>
      </div>
    </motion.button>
  );
}

// ── Selected card chip ───────────────────────────────────────────────────────────
export function SelectedChip({ card, onRemove }: { card: InventoryRow; onRemove: () => void }) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold"
      style={{
        background: `${color}15`,
        borderColor: `${color}40`,
        color,
        boxShadow: `0 0 12px -5px ${color}60`,
      }}
    >
      {card.cardImageUrl && (
        <img src={card.cardImageUrl} alt="" className="w-4 h-5 object-contain rounded" />
      )}
      <span className="truncate max-w-[80px] text-[10px]">{card.cardName}</span>
      <span className="text-[#fbbf24] text-[10px]">${Number(card.value).toFixed(2)}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 text-gray-500 hover:text-white transition-colors text-xs leading-none"
      >
        ✕
      </button>
    </motion.div>
  );
}
