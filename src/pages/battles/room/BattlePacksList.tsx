import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface BattlePack {
  id: string;
  name: string;
  imageUrl?: string;
  emoji?: string;
  price: number;
  glowColor?: string;
}

interface Props {
  packs: BattlePack[];
  currentRound?: number;
  isOpening?: boolean;
  isSpinning?: boolean;
}

export const BattlePacksList: React.FC<Props> = ({
  packs,
  currentRound = -1,
  isOpening = false,
  isSpinning = false,
}) => {
  // Lock completed rounds — once a pack gets a ✓ it never reverts
  const maxCompletedRef = useRef(-1);

  return (
    <div className="flex gap-4 flex-wrap mb-8 justify-center">
      {packs.map((p, i) => {
        const isPast = i <= maxCompletedRef.current || i < currentRound;
        const isCurrent = i === currentRound && isOpening && !isPast;
        const isCurrentSpinning = isCurrent && isSpinning;
        const isFuture = i > currentRound && !isPast;

        // Persist completed rounds so they never revert
        if (isPast && i > maxCompletedRef.current) {
          maxCompletedRef.current = i;
        }

        return (
          <motion.div
            key={i}
            initial={false}
            animate={
              isCurrentSpinning
                ? { scale: [1, 1.08, 1], borderColor: ['rgba(255,215,0,0.3)', 'rgba(255,215,0,0.8)', 'rgba(255,215,0,0.3)'] }
                : {}
            }
            transition={{ repeat: isCurrentSpinning ? Infinity : 0, duration: 1.0 }}
            className="relative flex items-center justify-center p-1 rounded-2xl border-2 transition-all duration-300"
            style={{
              background: isCurrentSpinning
                ? 'rgba(255,255,255,0.08)'
                : isCurrent
                  ? 'rgba(255,255,255,0.05)'
                  : isPast
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.03)',
              borderColor: isCurrentSpinning
                ? 'rgba(255,215,0,0.5)'
                : isCurrent
                  ? 'rgba(255,255,255,0.25)'
                  : isPast
                    ? 'rgba(34,197,94,0.3)'
                    : 'rgba(255,255,255,0.1)',
              opacity: isFuture ? 0.35 : 1,
              filter: isFuture ? 'brightness(0.6)' : 'none',
              boxShadow: isCurrentSpinning ? '0 0 20px rgba(255,215,0,0.2)' : 'none',
            }}
          >
            <div className="relative">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-16 h-16 md:w-20 md:h-20 object-contain" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl">
                  {p.emoji || '📦'}
                </div>
              )}

              {/* Status badge */}
              <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shadow-lg transition-colors duration-200 ${
                isPast
                  ? 'bg-green-500 border-green-400 text-white'
                  : isCurrentSpinning
                    ? 'bg-[#ffd700] border-[#fff] text-black animate-pulse'
                    : isCurrent
                      ? 'bg-amber-500/60 border-amber-400/40 text-white/70'
                      : 'bg-white/10 border-white/20 text-white/30'
              }`}>
                {isPast ? '✓' : i + 1}
              </div>
            </div>

            {!isOpening && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {p.name}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
