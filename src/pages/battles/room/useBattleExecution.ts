/**
 * useBattleExecution — delegates ALL economy logic to backend.
 *
 * After the backend responds with results, the host drives the animation
 * loop by dispatching BattleStep actions locally. Non-host clients poll
 * the battle API for state changes.
 */
import { useCallback, useRef } from 'react';
import { blink } from '../../../lib/blink';
import type { Battle } from '../battleTypes';
import type { StepAction } from './useBattleStepMachine';
import { executeBattle } from '../../../lib/api';
import { useSoundSetting } from '../../../hooks/useSoundSetting';
import { useTickSound } from '../../../hooks/useTickSound';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const SPIN_DURATION_MS = 3500;
const TICK_DURATION_MS = 3000;
const SETTLE_PAUSE_MS = 400;
const REVEAL_ADMIRE_MS = 1500;
const PRE_SPIN_DELAY_MS = 600;
const WINNER_DELAY_MS = 500;

export const useBattleExecution = ({
  battleId,
  user,
  watchOnly,
  dispatch,
  qc,
}: {
  battleId: string;
  user: any;
  watchOnly: boolean;
  dispatch: (action: StepAction) => void;
  qc: any;
}) => {
  const { enabled: soundEnabled } = useSoundSetting();
  const { startDecel, stop: stopTick } = useTickSound(soundEnabled);
  const launchInFlight = useRef(false);

  const launchBattle = useCallback(async (currentBattle: Battle) => {
    if (!currentBattle || launchInFlight.current) return;

    const isHost = user?.id === currentBattle.hostUserId;
    // Non-host clients never execute settlement. Their animation is driven by
    // useBattleState once the backend has persisted real card results.
    if (!isHost || watchOnly) return;

    launchInFlight.current = true;
    dispatch({ type: 'LOADING' });

    try {
      console.log(`[useBattleExecution] Executing battle ${battleId}...`);

      const result = await executeBattle(battleId);
      console.log(`[useBattleExecution] executeBattle success:`, !!result);

      const { playerResults, winner: winnerResult, isDraw } = result;
      let battlePacks: any[] = [];
      try {
        battlePacks = JSON.parse(currentBattle.packsJson || '[]');
      } catch {
        throw new Error('Battle pack data is invalid');
      }
      const numPacks = battlePacks.length;

      dispatch({ type: 'SET_RESULTS', results: playerResults });

      for (let round = 0; round < numPacks; round++) {
        dispatch({ type: 'SETTLE', round, landing: false });
        await sleep(PRE_SPIN_DELAY_MS);

        dispatch({ type: 'START_SPIN', round });
        startDecel(TICK_DURATION_MS);

        blink.db.battles.update(battleId, {
          currentRound: round,
          isSpinning: 1,
        }).catch(e => console.warn('[useBattleExecution] DB update failed:', e.message));

        await sleep(SPIN_DURATION_MS);

        dispatch({ type: 'SETTLE', round, landing: true });
        stopTick();

        blink.db.battles.update(battleId, { isSpinning: 0 })
          .catch(e => console.warn('[useBattleExecution] DB update failed:', e.message));

        await sleep(SETTLE_PAUSE_MS);
        dispatch({ type: 'REVEAL', round });
        await sleep(REVEAL_ADMIRE_MS);
      }

      await sleep(WINNER_DELAY_MS);
      const finalWinner = winnerResult || (isDraw ? null : (() => {
        const sorted = playerResults.slice().sort((a, b) => {
          const av = Number(a.totalValue || 0);
          const bv = Number(b.totalValue || 0);
          return currentBattle.mode === 'underdog' ? av - bv : bv - av;
        });
        return sorted[0] || null;
      })());
      dispatch({ type: 'WINNER', winner: finalWinner });

      // Battle status and settlement timestamps are backend-authoritative.
      // Do not let the client mark a battle finished after a failed backend
      // settlement; the previous behavior could display FINISHED while the
      // database still contained no cards/rewards.
    } catch (err: any) {
      console.error('[useBattleExecution] critical error:', err);
      stopTick();
      dispatch({ type: 'WINNER', winner: null });
    } finally {
      launchInFlight.current = false;
    }
  }, [battleId, user?.id, watchOnly, dispatch, startDecel, stopTick]);

  return { launchBattle };
};
