import React from 'react';
import { motion } from 'framer-motion';

interface Pack {
  id: string;
  name: string;
  price: number;
  emoji?: string;
  imageUrl?: string;
  color?: string;
  glowColor?: string;
}

interface CardResult {
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  imageUrl?: string;
}

interface PackVisualProps {
  pack: Pack;
  card: CardResult | null;
  stage: 'idle' | 'opening' | 'reveal' | 'done';
  flipped: boolean;
  rarityColor: string;
  packColor: string;
  onPackClick: () => void;
  error: string | null;
  isHighValue: boolean;
}

export const PackVisual: React.FC<PackVisualProps> = ({
  pack,
  card,
  stage,
  flipped,
  rarityColor,
  packColor,
  onPackClick,
  error,
  isHighValue,
}) => {
  return (
    <>
      {/* Particles for high-value pulls */}
      {isHighValue && flipped && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), y: typeof window !== 'undefined' ? window.innerHeight : 800 }}
              animate={{ opacity: 0, y: -100, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000) }}
              transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5 }}
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: rarityColor }}
            />
          ))}
        </div>
      )}

      <div
        className="relative mx-auto w-64 h-80 cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={stage === 'idle' ? onPackClick : undefined}
      >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front: Pack */}
        <div
          className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center space-y-4 border"
          style={{
            backfaceVisibility: 'hidden',
            background: 'rgba(255,255,255,0.04)',
            borderColor: packColor + '40',
            boxShadow: `0 0 40px -10px ${packColor}60`,
          }}
        >
          {pack.imageUrl ? (
            <img src={pack.imageUrl} alt={pack.name} className="h-40 w-auto object-contain" />
          ) : (
            <div className="text-8xl">{pack.emoji || '📦'}</div>
          )}
          <p className="text-lg font-display uppercase tracking-wider text-white">{pack.name}</p>
          {stage === 'idle' && !error && (
            <p className="text-xs text-white/40 animate-pulse tracking-widest uppercase">Click to Open</p>
          )}
          {stage === 'opening' && (
            <p className="text-xs animate-pulse tracking-widest uppercase" style={{ color: packColor }}>Opening...</p>
          )}
        </div>

        {/* Back: Card Reveal */}
        {card && (
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center space-y-5 border"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(135deg, rgba(0,0,0,0.9), ${rarityColor}18)`,
              borderColor: rarityColor,
              boxShadow: `0 0 60px -10px ${rarityColor}80`,
            }}
          >
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.name} className="h-32 w-auto object-contain rounded-lg" />
            ) : (
              <div className="text-7xl">{card.emoji}</div>
            )}
            <div className="text-center space-y-1.5">
              <p className="text-xl font-display text-white">{card.name}</p>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: rarityColor }}>
                {card.rarity} {card.rarity === 'god' ? '⭐⭐⭐' : card.rarity === 'secret' ? '⭐⭐' : card.rarity === 'ultra' ? '⭐' : ''}
              </p>
              <motion.p
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="text-3xl font-display font-bold"
                style={{ color: rarityColor }}
              >
                ${card.value.toFixed(2)}
              </motion.p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
    </>
  );
};
