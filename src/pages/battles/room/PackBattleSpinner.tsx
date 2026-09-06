/**
 * PackBattleSpinner — visual spinner for the Pack Battle room.
 *
 * ANIMATION STATE DRIVEN BY `battleStep` PROP (single source of truth).
 * Internal `stripPhase` tracks the visual lifecycle:
 *
 *   battleStep.settled(landing=false) → stripPhase='idle'      → strip at x=0
 *   battleStep.spinning               → stripPhase='spinning'  → animating to target
 *   battleStep.settled(landing=true)  → stripPhase='landed'    → locked at target
 *   battleStep.revealed               → stripPhase='revealed'  → show "PULLED" overlay
 *
 * The spinner never depends on external sleep() timers — it only
 * responds to the step prop changing.
 */
import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BattleStep } from '../battleTypes';

const TILE_W = 100;
const TILE_GAP = 6;
const TILE_COUNT = 30;
const WINNER_IDX = 24;

interface Card {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  imageUrl?: string;
}

interface Props {
  winnerCard: Card;
  battleStep: BattleStep;
  glowColor: string;
  packCards?: any[];
  round: number;
}

export const PackBattleSpinner: React.FC<Props> = ({
  winnerCard,
  battleStep,
  glowColor,
  packCards = [],
  round,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hasMeasured, setHasMeasured] = useState(false);

  // ── Internal visual phase, driven entirely by battleStep ────────────────
  type StripPhase = 'idle' | 'spinning' | 'landed' | 'revealed';
  const [stripPhase, setStripPhase] = useState<StripPhase>('idle');

  useEffect(() => {
    switch (battleStep.type) {
      case 'settled':
        setStripPhase(battleStep.landing ? 'landed' : 'idle');
        break;
      case 'spinning':
        if (battleStep.round === round) setStripPhase('spinning');
        break;
      case 'revealed':
        if (battleStep.round === round) setStripPhase('revealed');
        break;
      default:
        // idle / countdown / loading / winner — no spinner changes
        break;
    }
  }, [battleStep, round]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
        setHasMeasured(true);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const baseTarget = -WINNER_IDX * (TILE_W + TILE_GAP) - TILE_W / 2 - 8;
  // The target is derived only after the container has a real width. Keeping
  // the pre-measure state at x=0 prevents a second transition from the
  // placeholder fallback value when the spinner mounts.
  const targetX = containerWidth / 2 + baseTarget;

  // ── Position from stripPhase ────────────────────────────────────────────
  const stripX =
    stripPhase === 'spinning' || stripPhase === 'landed' || stripPhase === 'revealed'
      ? targetX
      : 0;

  // ── Transition from stripPhase ──────────────────────────────────────────
  const transition =
    stripPhase === 'spinning'
      ? { duration: 3.5, ease: [0.05, 0.8, 0.3, 1] as const }  // spin easing
      : stripPhase === 'landed'
        ? { duration: 0.2, ease: 'easeOut' as const }    // settle ease-out
        : { duration: 0 };                               // idle/revealed: snap instantly

  // ── Build strip tiles using real pack card data ─────────────────────────
  const strip = React.useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => {
    if (i === WINNER_IDX) {
      return {
        id: `win-${round}`,
        name: stripPhase === 'revealed' ? winnerCard.name : '???',
        emoji: winnerCard.emoji,
        rarity: winnerCard.rarity,
        value: winnerCard.value,
        imageUrl: winnerCard.imageUrl,
        isWinner: true,
      };
    }
    const cardIdx = Math.abs((round * 13 + i * 7) % Math.max(1, packCards.length));
    const randomCard = packCards[cardIdx];
    if (randomCard) {
      return {
        id: `fake-${round}-${i}-${randomCard.id}`,
        name: stripPhase === 'revealed' ? (randomCard.cardName || randomCard.name) : '???',
        emoji: randomCard.emoji || '🃏',
        rarity: randomCard.rarity,
        value: Number(randomCard.estimatedValue || randomCard.value || 0),
        imageUrl: randomCard.cardImageUrl || randomCard.imageUrl,
        isWinner: false,
      };
    }
    return { id: `fake-${round}-${i}`, name: '???', emoji: '🃏', rarity: 'common', value: 0, isWinner: false };
  }), [winnerCard, packCards, round, stripPhase]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-32 bg-black/40 rounded-xl border border-white/10 overflow-hidden"
    >
      {/* Hairline marker */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-px w-[2px] z-20 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent, ${glowColor}, transparent)` }} />

      <motion.div
        className="flex gap-[6px] items-center h-full px-2"
        initial={false}
        // Do not animate from the placeholder width. Waiting for the first
        // real measurement removes the visible one-frame jump on open.
        animate={{ x: hasMeasured ? stripX : 0 }}
        transition={transition}
      >
        {strip.map((card, i) => (
          <div
            key={i}
            className={`shrink-0 flex flex-col items-center justify-center rounded-lg border ${
              stripPhase === 'revealed' && card.isWinner
                ? 'border-[#ffd700] bg-[#ffd700]/10 shadow-[0_0_12px_rgba(255,215,0,0.3)]'
                : 'border-white/10 bg-white/5'
            }`}
            style={{ width: TILE_W, height: 100 }}
          >
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.name} className="h-12 w-auto object-contain" />
            ) : (
              <span className="text-2xl">{card.emoji}</span>
            )}
            <p className={`text-[8px] mt-1 uppercase tracking-tighter truncate max-w-[90px] ${
              stripPhase === 'revealed' ? 'text-white/50' : 'text-white/20'
            }`}>
              {card.name}
            </p>
          </div>
        ))}
      </motion.div>

      {/* "PULLED" overlay — only after reveal */}
      <AnimatePresence>
        {stripPhase === 'revealed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="px-4 py-2 rounded-xl text-center"
              style={{
                background: `rgba(0,0,0,0.85)`,
                border: `1px solid ${glowColor}40`,
                boxShadow: `0 0 20px -5px ${glowColor}60`,
              }}
            >
              <p className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Pulled</p>
              <p className="text-sm font-display text-white font-bold">{winnerCard.name}</p>
              <p className="text-[#ffd700] text-xs font-bold">${winnerCard.value.toFixed(2)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
