import React from 'react';
import { motion } from 'framer-motion';

interface ReceivedCard {
  id: string;
  cardId: string;
  cardName: string;
  rarity: string;
  value: number;
  emoji: string;
  cardImageUrl: string | null;
  isLocked: boolean;
}

interface ExchangeSuccessOverlayProps {
  wonCards: ReceivedCard[];
  refund: number;
  onDismiss: () => void;
}

const RARITY_GLOW: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  ultra: '#a78bfa',
  secret: '#fbbf24',
  god: '#f43f5e',
};

export const ExchangeSuccessOverlay: React.FC<ExchangeSuccessOverlayProps> = ({ wonCards, refund, onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        onClick={e => e.stopPropagation()}
        className="glass-card p-8 text-center max-w-md w-full relative overflow-hidden"
        style={{ borderColor: 'rgba(0,200,255,0.35)', boxShadow: '0 0 60px -10px rgba(0,200,255,0.45)' }}
      >
        {/* Particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div key={i} className="absolute w-2 h-2 rounded-full"
            style={{ background: ['#00c8ff','#9b5cff','#ffd700','#10b981'][i % 4], left: '50%', top: '50%' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos((i / 12) * 2 * Math.PI) * (70 + (i % 3) * 20), y: Math.sin((i / 12) * 2 * Math.PI) * (70 + (i % 3) * 20), opacity: 0, scale: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
          />
        ))}

        <h3 className="font-display text-3xl uppercase mb-4"
          style={{ color: '#00c8ff', textShadow: '0 0 30px rgba(0,200,255,0.8)' }}>
          Exchange Complete!
        </h3>

        {/* ── Received cards ── */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {wonCards.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2 + i * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
              className="relative rounded-xl p-3 w-24 flex flex-col items-center gap-1"
              style={{
                background: `linear-gradient(135deg, ${(RARITY_GLOW[card.rarity] || '#9ca3af')}15, ${(RARITY_GLOW[card.rarity] || '#9ca3af')}05)`,
                border: `1.5px solid ${(RARITY_GLOW[card.rarity] || '#9ca3af')}40`,
                boxShadow: `0 0 18px -4px ${(RARITY_GLOW[card.rarity] || '#9ca3af')}60`,
              }}
            >
              {card.cardImageUrl ? (
                <img
                  src={card.cardImageUrl}
                  alt={card.cardName}
                  className="w-16 h-20 object-contain rounded-md"
                />
              ) : (
                <span className="text-3xl">{card.emoji}</span>
              )}
              <p className="text-[10px] font-bold text-center leading-tight text-white line-clamp-2">
                {card.cardName}
              </p>
              <span className="text-[11px] font-display font-bold" style={{ color: RARITY_GLOW[card.rarity] || '#9ca3af' }}>
                ${card.value.toFixed(2)}
              </span>
            </motion.div>
          ))}
        </div>

        {refund > 0.01 && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-[#10b981] font-bold text-base mb-1">
            +${refund.toFixed(2)} refunded to balance
          </motion.p>
        )}

        <button onClick={onDismiss}
          className="mt-4 px-8 py-3 rounded-xl text-black font-display text-base uppercase font-bold transition-all shimmer-btn"
          style={{ background: '#00c8ff', boxShadow: '0 0 20px -5px rgba(0,200,255,0.6)' }}>
          Sweet!
        </button>
      </motion.div>
    </motion.div>
  );
};
