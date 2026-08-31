import { useRef, useState } from 'react';
import { BALANCE_QUERY_KEY } from '../../../hooks/useBalance';
import { cancelBattle as cancelBattleAPI, addAIOpponent as addAIAPI } from '../../../lib/api';

export const useBattleActions = ({
  battleId,
  battle,
  user,
  stats,
  updateBalance,
  fetchBattleState,
  qc
}: any) => {
  const [addingAI, setAddingAI] = useState(false);
  const addRequestInFlight = useRef(false);

  const addAIOpponent = async (name?: string) => {
    if (!battle || !user || addRequestInFlight.current) return;
    // battle.players is not populated by the room state fetch. The backend
    // performs the authoritative capacity check, so do not block a valid bot
    // add based on this optional/stale relation.
    const playerCount = Array.isArray(battle.players) ? battle.players.length : 0;
    const configuredMax = Math.min(Number(battle.playerCount) || 2, 4);
    if (playerCount >= configuredMax) {
      await fetchBattleState();
      return;
    }
    addRequestInFlight.current = true;
    setAddingAI(true);
    try {
      // Backend validates host, adds AI player
      await addAIAPI(battleId, name);
      await fetchBattleState();
    } catch (e: any) {
      // The backend may reject a stale click after the battle starts; refresh
      // the room without emitting a scary runtime error to the user console.
      if (e?.message !== 'Cannot add AI now') {
        console.error('addAIOpponent error:', e.message);
      }
      await fetchBattleState();
    } finally {
      addRequestInFlight.current = false;
      setAddingAI(false);
    }
  };

  const cancelBattle = async () => {
    if (!battle || !user || !stats) return;

    try {
      // Backend validates host, cancels battle, refunds balance
      const result = await cancelBattleAPI(battleId);
      
      // Update local balance from backend-authoritative value
      await updateBalance(result.newBalance);

      qc.invalidateQueries({ queryKey: ['battles'] });
      qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, user?.id] });

      return true;
    } catch (e: any) {
      console.error('cancelBattle error:', e.message);
      alert(e.message || 'Failed to cancel battle. Please try again.');
      return false;
    }
  };

  return {
    addingAI,
    addAIOpponent,
    cancelBattle
  };
};
