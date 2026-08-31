import React from 'react';
import { motion } from 'framer-motion';
import { Star, DollarSign, Lock, Unlock } from 'lucide-react';
import { InventoryCard, RARITY_COLORS } from './inventoryTypes';

interface InventoryCardTileProps {
  card: InventoryCard;
  index: number;
  selling: string | null;
  sellConfirm: string | null;
  onToggleLock: (card: InventoryCard) => void;
  onToggleFavorite: (card: InventoryCard) => void;
  onSetLightbox: (lightbox: { src: string; alt: string; rarityColor: string } | null) => void;
  onSetSellConfirm: (val: string | null) => void;
  onHandleSell: (card: InventoryCard) => void;
}

export const InventoryCardTile: React.FC<InventoryCardTileProps> = ({
  card,
  index,
  selling,
  sellConfirm,
  onToggleLock,
  onToggleFavorite,
  onSetLightbox,
  onSetSellConfirm,
  onHandleSell,
}) => {
  const color = RARITY_COLORS[card.rarity] || '#9ca3af';
  const isSelling = selling === card.cardId;
  const isConfirming = sellConfirm === card.cardId;
  const isLocked = card.isLocked;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -6 }}
      className="relative cursor-pointer group rounded-xl overflow-hidden border transition-all"
      style={{
        background: isLocked ? 'rgba(10,11,16,0.95)' : 'rgba(13,14,20,0.9)',
        borderColor: isLocked ? 'rgba(245,158,11,0.4)' : color + '30',
        boxShadow: isLocked
          ? '0 0 20px -8px rgba(245,158,11,0.35)'
          : `0 0 20px -8px ${color}40`,
      }}
    >
      {/* Lock icon button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(card); }}
        className={`absolute top-2 right-2 z-10 transition-opacity ${
          isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        title={isLocked ? 'Unlock card' : 'Lock card'}
      >
        {isLocked ? (
          <Lock
            size={13}
            style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.7))' }}
          />
        ) : (
          <Unlock size={13} style={{ color: '#6b7280' }} />
        )}
      </button>

      {/* Favorite star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(card); }}
        className="absolute top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ right: '26px' }}
        title={card.isFavorite ? 'Unfavorite' : 'Favorite'}
      >
        <Star
          size={13}
          className="transition-colors"
          style={{ color: card.isFavorite ? '#fbbf24' : '#6b7280', fill: card.isFavorite ? '#fbbf24' : 'none' }}
        />
      </button>

      {/* Card image or emoji */}
      <div
        className="w-full flex items-center justify-center relative"
        style={{ height: '120px', background: 'rgba(0,0,0,0.3)' }}
      >
        {card.cardImageUrl ? (
          <img
            src={card.cardImageUrl}
            alt={card.cardName}
            className={`h-full w-auto object-contain py-2 cursor-zoom-in transition-transform duration-200 hover:scale-105 ${isLocked ? 'opacity-60' : ''}`}
            onClick={() => !isLocked && onSetLightbox({ src: card.cardImageUrl!, alt: card.cardName, rarityColor: color })}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            loading="lazy"
          />
        ) : (
          <div className={`text-4xl ${isLocked ? 'opacity-60' : ''}`}>{card.emoji}</div>
        )}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex flex-col items-center gap-0.5"
              style={{ background: 'rgba(0,0,0,0.45)', borderRadius: '8px', padding: '4px 8px' }}
            >
              <Lock size={18} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.8))' }} />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Locked</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1">
        <p className="text-xs font-bold leading-tight truncate text-white">{card.cardName}</p>
        <p className="text-[10px] font-bold uppercase" style={{ color }}>
          {card.rarity}
        </p>
        {card.packName && (
          <p className="text-[9px] text-white/25 truncate">{card.packName}</p>
        )}
        <p className="text-sm font-display" style={{ color: '#fbbf24' }}>
          ${card.value.toFixed(2)}
        </p>

        {/* Sell button */}
        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-all">
          {isLocked ? (
            <div
              className="w-full py-1.5 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 cursor-not-allowed"
              style={{ background: 'rgba(245,158,11,0.06)', color: '#6b7280', border: '1px solid rgba(245,158,11,0.15)' }}
              title="Unlock card to sell"
            >
              <Lock size={9} style={{ color: '#f59e0b' }} /> Protected
            </div>
          ) : isConfirming ? (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onHandleSell(card); }}
                disabled={isSelling}
                className="flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all"
                style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
              >
                {isSelling ? '...' : 'Confirm'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSetSellConfirm(null); }}
                className="px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg bg-white/5 text-gray-400 border border-white/10 transition-all"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onSetSellConfirm(card.cardId); }}
              className="w-full py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <DollarSign size={9} /> Sell ${card.value.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
