import React from 'react';
import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { MODE_INFO } from './battleUtils';
import { useBattleRoom } from './room/useBattleRoom';

// Sub-components
import { BattleRoomHeader } from './room/BattleRoomHeader';
import { BattlePacksList } from './room/BattlePacksList';
import { BattleLobby } from './room/BattleLobby';
import { BattleOpening } from './room/BattleOpening';
import { BattleResults } from './room/BattleResults';
import { BattleCountdown } from './room/BattleCountdown';

interface Props {
  battleId: string;
  onBack: () => void;
  watchOnly?: boolean;
}

export const BattleRoom: React.FC<Props> = ({ battleId, onBack, watchOnly = false }) => {
  const {
    battle,
    players,
    phase,
    countdown,
    results,
    winner,
    currentRound,
    isRoundSpinning,
    battleStep,
    showWinner,
    aiCountdown,
    aiTimerFinished,
    loading,
    addingAI,
    packCardsMap,
    battleError,
    user,
    addAIOpponent,
    cancelBattle,
  } = useBattleRoom(battleId, watchOnly);

  const [cancelling, setCancelling] = React.useState(false);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this battle? You will be fully refunded.')) return;
    setCancelling(true);
    const success = await cancelBattle();
    if (success) {
      onBack();
    } else {
      alert('Failed to cancel battle. Please try again.');
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#00c8ff]/30 border-t-[#00c8ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center flex-col gap-4">
        <Swords size={40} className="text-gray-700" />
        <p className="text-gray-500">Battle not found.</p>
        <button onClick={onBack} className="text-[#00c8ff] text-sm hover:underline">Go back</button>
      </div>
    );
  }

  const safeMode = battle.mode || 'standard';
  const modeInfo = MODE_INFO[safeMode] || MODE_INFO.standard;
  const battlePacks = (() => {
    try {
      return JSON.parse(battle.packsJson || '[]') as any[];
    } catch {
      return [];
    }
  })();
  const isHost = user?.id === battle.hostUserId;
  // Finished status is authoritative after a refresh. Recover the winner from
  // persisted player flags or the battle row even if the local step reducer was
  // reset during navigation/polling.
  const persistedWinner = results.find(r => r.isWinner)
    || results.find(r => r.userId === battle.winnerUserId)
    || null;
  const effectiveWinner = winner || persistedWinner;
  // A backend-completed battle can still be waiting for its local presentation
  // to finish. The step machine is the only source of truth for this banner.
  const effectiveShowWinner = showWinner;
  // The host is always an enrolled player by the create flow. Treat that as
  // authoritative while the player list query catches up so lobby controls do
  // not depend on a second request resolving first.
  const isPlayer = isHost || (players || []).some(p => p.userId === user?.id);

  return (
    <div className="min-h-screen bg-[#0a0b0f] px-4 py-8 relative overflow-hidden">
      {/* Animated background glow */}
      {(phase === 'countdown' || phase === 'opening') && (
        <motion.div
          className="fixed inset-0 pointer-events-none"
          animate={{ opacity: [0.1, 0.25, 0.1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ background: `radial-gradient(ellipse at center, ${modeInfo.color}22, transparent 70%)` }}
        />
      )}

      {watchOnly && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Spectating Live Battle
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <BattleRoomHeader 
          mode={safeMode} 
          status={battle.status} 
          isPublic={battle.isPublic} 
          onBack={onBack} 
        />

        <BattlePacksList 
          packs={battlePacks} 
          currentRound={currentRound}
          isOpening={phase === 'opening'}
          isSpinning={isRoundSpinning}
        />

        <BattleCountdown 
          countdown={countdown} 
          color={modeInfo.color} 
          isVisible={phase === 'countdown'} 
        />

        {phase === 'lobby' && (
          <BattleLobby 
            battle={battle} 
            players={players} 
            isHost={isHost}
            isPlayer={isPlayer}
            aiCountdown={aiCountdown} 
            aiTimerFinished={aiTimerFinished}
            addingAI={addingAI} 
            onAddAI={addAIOpponent} 
            onCancel={handleCancel}
            cancelling={cancelling}
          />
        )}

        {(phase === 'opening' || phase === 'results' || battle.status === 'finished') && (
          <div className="space-y-4">
            <BattleOpening 
              results={results} 
              battleStep={battleStep}
              mode={safeMode} 
              packs={battlePacks}
              packCardsMap={packCardsMap}
            />

            <BattleResults 
              winner={effectiveWinner} 
              results={results} 
              mode={safeMode} 
              userId={user?.id} 
              showWinner={effectiveShowWinner}
              onBack={onBack} 
            />
          </div>
        )}

        {battleError && <p className="text-red-400 text-sm mt-4">{battleError}</p>}
      </div>
    </div>
  );
};