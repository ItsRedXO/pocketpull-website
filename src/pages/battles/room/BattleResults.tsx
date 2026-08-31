import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import type { PlayerBattleResult } from '../battleTypes';
import { MODE_INFO } from '../battleUtils';

interface Props {
  winner: PlayerBattleResult | null;
  results: PlayerBattleResult[];
  mode: string;
  userId?: string;
  showWinner: boolean;
  onBack: () => void;
}

export const BattleResults: React.FC<Props> = ({
  winner,
  results,
  mode,
  userId,
  showWinner,
  onBack,
}) => {
  const safeMode = mode || 'standard';
  const modeInfo = MODE_INFO[safeMode] || MODE_INFO.standard;

  // Only consider this a draw when the battle is fully complete
  // (step === 'winner') and no player has the isWinner flag.
  // Shared mode also has no winner but is not a draw — players split rewards.
  const safeResults = results || [];
  const isTeamBattle = safeResults.some(r => r.teamSide === 'left' || r.teamSide === 'right');
  const leftResults = safeResults.filter(r => r.teamSide === 'left');
  const rightResults = safeResults.filter(r => r.teamSide === 'right');
  const leftTotal = leftResults.reduce((sum, r) => sum + Number(r.totalValue || 0), 0);
  const rightTotal = rightResults.reduce((sum, r) => sum + Number(r.totalValue || 0), 0);
  const winningSide = leftTotal === rightTotal ? null : leftTotal > rightTotal ? 'left' : 'right';
  const userWonTeam = isTeamBattle && !!winningSide && safeResults.some(r => r.userId === userId && r.teamSide === winningSide);
  const normalizedTotals = safeResults.map(r => Math.round(Number(r.totalValue || 0) * 100));
  const standardWinner = safeMode === 'underdog'
    ? Math.min(...normalizedTotals)
    : Math.max(...normalizedTotals);
  const hasAuthoritativeWinner = safeResults.some(r => r.isWinner);
  const calculatedWinner = !isTeamBattle && safeResults.length > 0 && !hasAuthoritativeWinner && normalizedTotals.length > 1
    ? safeResults[normalizedTotals.indexOf(standardWinner)]
    : null;
  // Recover a display winner from persisted card totals if an older battle was
  // saved before winner flags were written. Exact ties remain draws.
  const isExactDisplayTie = normalizedTotals.length >= 2 && normalizedTotals.every(total => total === standardWinner);
  const displayedWinner = winner || calculatedWinner;
  const isDraw = showWinner && !displayedWinner && !hasAuthoritativeWinner && safeResults.length >= 2 && safeMode !== 'shared' && !isTeamBattle && isExactDisplayTie;

  // Viewer-specific result color: green if they won, red if they lost
  const resultColor = isTeamBattle
    ? (userWonTeam ? '#10b981' : '#ef4444')
    : displayedWinner
      ? (displayedWinner.userId === userId && !displayedWinner.isAi ? '#10b981' : '#ef4444')
      : modeInfo.color;

  return (
    <AnimatePresence>
      {showWinner && (displayedWinner || isDraw || safeMode === 'shared' || isTeamBattle) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="text-center py-8 rounded-2xl relative overflow-hidden mt-4"
          style={{
            background: `linear-gradient(135deg, ${modeInfo.color}15, transparent)`,
            border: `2px solid ${modeInfo.color}40`,
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: `inset 0 0 60px -20px ${modeInfo.color}` }}
          />
          <Crown size={48} className="mx-auto mb-3" style={{ color: modeInfo.color }} />
          {isTeamBattle ? (
            <>
              <h2 className="font-display text-4xl uppercase" style={{ color: winningSide ? '#ffd700' : '#9ca3af', textShadow: winningSide ? '0 0 30px #ffd700' : 'none' }}>
                {winningSide ? `${winningSide.toUpperCase()} TEAM WINS!` : 'TEAM DRAW!'}
              </h2>
              <p className="mt-2 text-gray-400">Left {leftTotal.toFixed(2)} · Right {rightTotal.toFixed(2)}</p>
              <p className="mt-3 text-[#00c8ff] text-xs uppercase tracking-widest font-bold">
                {userWonTeam ? 'Your team splits the winnings evenly.' : winningSide ? 'The winning team receives the winnings.' : 'Each team keeps its own pulls.'}
              </p>
            </>
          ) : isDraw ? (
            <>
              <h2
                className="font-display text-4xl uppercase"
                style={{
                  color: '#ffd700',
                  textShadow: '0 0 30px #ffd700',
                }}
              >
                DRAW!
              </h2>
              <p className="text-gray-400 mt-2">
                Exact tie — each player keeps their own cards.
              </p>
              <p className="font-display text-2xl mt-3 text-[#ffd700]">
                ${safeResults.reduce((s, r) => s + Number(r.totalValue || 0), 0).toFixed(2)} total value
              </p>
            </>
          ) : safeMode === 'shared' ? (
            <>
              <h2
                className="font-display text-4xl uppercase"
                style={{
                  color: modeInfo.color,
                  textShadow: `0 0 30px ${modeInfo.color}`,
                }}
              >
                SHARED REWARDS!
              </h2>
              <p className="text-gray-400 mt-2">
                All players receive their pulled cards equally.
              </p>
            </>
          ) : (
            <>
              <h2
                className="font-display text-4xl uppercase"
                style={{
                  color: resultColor,
                  textShadow: `0 0 30px ${resultColor}`,
                }}
              >
                {displayedWinner?.isAi
                  ? `${displayedWinner.username} WINS!`
                  : displayedWinner?.userId === userId
                  ? 'YOU WIN!'
                  : `${displayedWinner?.username || 'OPPONENT'} WINS!`}
              </h2>
              {displayedWinner?.userId === userId && !displayedWinner.isAi ? (
                <div className="space-y-2">
                  <p className="text-gray-300 mt-2 text-lg">
                    All cards added to your inventory! 🎉
                  </p>
                  <p className="text-[#00c8ff] text-xs uppercase tracking-widest font-bold">
                    You won the entire battle pot ({(results || []).reduce((s, r) => s + (r.cards?.length || 0), 0)} cards)
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 mt-2">Better luck next time.</p>
              )}
              <p className="font-display text-2xl mt-3 text-[#ffd700]">
                ${safeResults.reduce((s, r) => s + Number(r.totalValue || 0), 0).toFixed(2)} total value
              </p>
            </>
          )}
          <button
            onClick={onBack}
            className="mt-6 px-8 py-3 rounded-xl font-display text-lg uppercase text-black shimmer-btn relative z-10"
            style={{
              background: `linear-gradient(135deg, ${modeInfo.color}, ${modeInfo.color}cc)`,
              boxShadow: `0 0 25px -5px ${modeInfo.color}`,
            }}
          >
            Back to Battles
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
