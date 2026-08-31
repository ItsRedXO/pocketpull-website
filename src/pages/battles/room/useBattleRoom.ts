import { useAuth, useUserStats } from '../../../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useBattleState } from './useBattleState';
import { useBattleLogic } from './useBattleLogic';
import { useBattleActions } from './useBattleActions';

export const useBattleRoom = (battleId: string, watchOnly: boolean = false) => {
  const { user } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const qc = useQueryClient();
  
  const state = useBattleState(battleId);
  
  const logic = useBattleLogic({
    battleId,
    battle: state.battle,
    players: state.players,
    user,
    watchOnly,
    dispatch: state.dispatch,
    battleRef: state.battleRef,
    qc
  });

  const actions = useBattleActions({
    battleId,
    battle: state.battle,
    user,
    stats,
    updateBalance,
    fetchBattleState: state.fetchBattleState,
    qc
  });

  return {
    user,
    
    // Core state
    battle: state.battle,
    players: state.players,
    loading: state.loading,
    packCardsMap: state.packCardsMap,
    battleError: state.battleError,

    // Battle step (new — single source of truth)
    battleStep: state.battleStep,
    results: state.results,
    winner: state.winner,

    // Derived (backward compat with BattleRoom.tsx)
    phase: state.phase,
    countdown: state.countdown,
    currentRound: state.currentRound,
    isRoundSpinning: state.isRoundSpinning,
    revealIndex: state.revealIndex,
    showWinner: state.showWinner,
    
    // From logic
    aiCountdown: logic.aiCountdown,
    aiTimerFinished: logic.aiTimerFinished,
    startBattleCountdown: logic.startBattleCountdown,
    
    // From actions
    addingAI: actions.addingAI,
    addAIOpponent: actions.addAIOpponent,
    cancelBattle: actions.cancelBattle
  };
};
