import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { RARITY_COLOR, TargetCard } from './constants';

// ── Result Overlay ─────────────────────────────────────────────────────────────
export function ResultOverlay({
  outcome, wonCards, onReset,
}: {
  outcome: 'win' | 'lose';
  wonCards: TargetCard[];
  onReset: () => void;
}) {
  const isWin = outcome === 'win';

  // Defensive check: if it's a loss, but wonCards contains a very high value card,
  // we might have a data sync issue. Let's filter wonCards to only show
  // what's appropriate for the outcome if the backend didn't already.
  const displayedCards = React.useMemo(() => {
    if (isWin) return wonCards;
    // On loss, only show low-value cards (consolation)
    return wonCards.filter(c => c.value <= 1.0);
  }, [isWin, wonCards]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
    >
      {/* Particles */}
      {isWin && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ['#10b981', '#00c8ff', '#ffd700', '#9b5cff', '#f43f5e'][i % 5],
                left: `${Math.random() * 100}%`,
                top: `60%`,
              }}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -300 - Math.random() * 200 }}
              transition={{ duration: 1.5 + Math.random(), delay: Math.random() * 0.4 }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
        className="max-w-md w-full rounded-2xl p-8 text-center"
        style={{
          background: 'rgba(13,14,20,0.98)',
          border: `1px solid ${isWin ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
          boxShadow: `0 0 60px -10px ${isWin ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
        }}
      >
        <div className="text-6xl mb-3">{isWin ? '🏆' : '💔'}</div>
        <h2
          className="font-display text-4xl uppercase tracking-widest mb-2"
          style={{
            color: isWin ? '#10b981' : '#ef4444',
            textShadow: `0 0 30px ${isWin ? '#10b981' : '#ef4444'}`,
          }}
        >
          {isWin ? 'YOU WON!' : 'YOU LOST!'}
        </h2>
        <p className="text-gray-400 text-sm mb-5">
          {isWin
            ? `${displayedCards.length === 1 ? displayedCards[0].name : `${displayedCards.length} cards`} added to your collection!`
            : (displayedCards.length > 0 
                ? `Upgrade Failed — You received: ${displayedCards[0].name}`
                : 'Your cards and balance were lost. Better luck next time.')}
        </p>

        {displayedCards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {displayedCards.map(c => {
              const col = RARITY_COLOR[c.rarity] ?? '#9ca3af';
              return (
                <div key={c.cardId} className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 border w-24 h-32 justify-center relative overflow-hidden"
                  style={{ borderColor: col + '40', background: col + '10' }}>
                  {c.cardImageUrl ? (
                    <img src={c.cardImageUrl} alt={c.name} className="w-16 h-20 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                  ) : (
                    <span className="text-3xl">{c.emoji}</span>
                  )}
                  <span className="text-[10px] font-bold text-white line-clamp-1">{c.name}</span>
                  <div className="flex items-center gap-1.5 uppercase font-black tracking-tighter" style={{ fontSize: '7px', color: col }}>
                    {c.rarity}
                  </div>
                  <span className="text-[10px] font-display" style={{ color: '#fbbf24' }}>${c.value.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
        >
          <RotateCcw size={14} /> Try Again
        </button>
      </motion.div>
    </motion.div>
  );
}
