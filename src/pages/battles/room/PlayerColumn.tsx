import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Crown } from 'lucide-react';
import type { PlayerBattleResult, BattleStep } from '../battleTypes';
import { RARITY_COLORS } from '../battleUtils';
import { PackBattleSpinner } from './PackBattleSpinner';
import { getUserColor } from '../../../lib/utils';

interface Props {
  result: PlayerBattleResult;
  battleStep: BattleStep;
  mode: string;
  currentPack: any;
  packCards?: any[];
}

export const PlayerColumn: React.FC<Props> = ({
  result,
  battleStep,
  mode,
  currentPack,
  packCards = [],
}) => {
  const cards = result?.cards || [];

  // ── Everything derived from battleStep ──────────────────────────────────
  const currentRound = battleStep.type === 'spinning' || battleStep.type === 'settled' || battleStep.type === 'revealed'
    ? battleStep.round : 0;
  const isRevealed = battleStep.type === 'revealed' && battleStep.round === currentRound;
  const showWinner = battleStep.type === 'winner';
  const isWinner = Number(result.isWinner) > 0 || result.isWinner === true;

  // Cards visible: all packs before current round + current pack if revealed
  // When winner is shown, all cards remain visible for review
  const visibleCards = showWinner ? cards : cards.slice(0, currentRound + (isRevealed ? 1 : 0));
  const currentTotalValue = showWinner
    ? cards.reduce((sum, c) => sum + (c.value || 0), 0)
    : visibleCards.reduce((sum, c) => sum + (c.value || 0), 0);

  // Card for the current round's spinner (hidden during spin).
  // After shared-mode redistribution, a player may have fewer cards than
  // there are packs. Use a graceful empty card so the spinner doesn't show
  // a $0 "?" placeholder.
  const spinnerCard = (cards[currentRound])
    ?? { name: 'No card this round', emoji: '🎴', value: 0, rarity: 'common', id: `empty-${currentRound}`, packId: '', packName: '', imageUrl: undefined };

  // Whether this player has no card for the current round (post-redistribution edge case)
  const hasNoCard = !cards[currentRound];

  return (
    <motion.div
      animate={
        showWinner && isWinner
          ? {
              boxShadow: [
                '0 0 0px transparent',
                '0 0 40px -5px #ffd700',
                '0 0 20px -5px #ffd700',
              ],
            }
          : {}
      }
      transition={{ repeat: isWinner ? Infinity : 0, duration: 1.5 }}
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border:
          showWinner && isWinner
            ? '2px solid rgba(255,215,0,0.5)'
            : '1.5px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Player header */}
      <div
        className="flex items-center gap-2 p-3 border-b border-white/6"
        style={{
          background:
            showWinner && isWinner ? 'rgba(255,215,0,0.08)' : 'transparent',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
          style={{ 
            backgroundColor: (result.isAi || !result.avatar?.startsWith('http')) ? getUserColor(result.username) : 'transparent',
            color: 'white'
          }}
        >
          {result.avatar?.startsWith('http') ? (
            <img src={result.avatar} alt="A" className="w-full h-full object-cover" />
          ) : (
            result.isAi ? <Bot size={14} /> : result.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{result.username}</p>
          {result.isAi && <p className="text-[10px] text-[#9b5cff]">AI</p>}
        </div>
        {showWinner && isWinner && mode !== 'shared' && (
          <Crown size={16} className="text-[#ffd700] shrink-0" />
        )}
      </div>

      {/* Spinner Area — shown during opening phase */}
      {!showWinner && (
        <div className="p-3 bg-black/20 border-b border-white/5">
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold">
            Pack {currentRound + 1}
          </p>
          {hasNoCard ? (
            <div className="flex items-center justify-center h-32 bg-black/30 rounded-xl border border-white/5">
              <p className="text-[10px] text-white/20 uppercase tracking-widest">
                No card this round
              </p>
            </div>
          ) : (
            <PackBattleSpinner
              key={`${result.playerId}-round-${currentRound}`}
              winnerCard={spinnerCard}
              battleStep={battleStep}
              glowColor={currentPack?.glowColor || '#00c8ff'}
              packCards={packCards}
              round={currentRound}
            />
          )}
        </div>
      )}

      {/* Live Total — only counts revealed cards */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
        <span className="text-xs text-gray-500">Live Total</span>
        <motion.span
          key={currentTotalValue}
          initial={{ scale: 1.2, color: '#fff' }}
          animate={{ scale: 1, color: '#ffd700' }}
          className="font-display text-xl"
        >
          ${currentTotalValue.toFixed(2)}
        </motion.span>
      </div>

      {/* Cards — only revealed cards shown */}
      <div className="flex-1 p-3 space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {visibleCards.length > 0 ? (
            visibleCards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex items-center gap-3 p-2 rounded-xl border border-white/10 shadow-lg"
                style={{
                  background: `${RARITY_COLORS[card.rarity] || '#888'}15`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="relative shrink-0">
                  {card.imageUrl ? (
                    <img 
                      src={card.imageUrl} 
                      alt={card.name} 
                      className="w-14 h-20 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                    />
                  ) : (
                    <div className="w-14 h-20 bg-white/5 rounded flex items-center justify-center border border-white/10">
                      <span className="text-2xl">{card.emoji}</span>
                    </div>
                  )}
                  <div 
                    className="absolute inset-0 opacity-20 blur-xl -z-10 rounded-full"
                    style={{ background: RARITY_COLORS[card.rarity] || '#888' }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate text-white uppercase tracking-tight">{card.name}</p>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest mt-0.5"
                    style={{ color: RARITY_COLORS[card.rarity] || '#888' }}
                  >
                    {card.rarity}
                  </p>
                  <div className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-[#ffd700]/10 border border-[#ffd700]/20">
                    <span className="text-[10px] font-bold text-[#ffd700]">
                      ${card.value.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex items-center justify-center h-20">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">Waiting for first reveal...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
