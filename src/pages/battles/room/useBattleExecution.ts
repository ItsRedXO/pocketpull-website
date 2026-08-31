/**
 * useBattleExecution — delegates ALL economy logic to backend.
 *
 * After the backend responds with results, the host drives the animation
 * loop by dispatching BattleStep actions locally.  Non-host clients poll
 * the battle API for state changes.
 *
 * The sleep() calls are only for pacing the animation — they are NOT
 * the source of truth for what the spinner does.  The spinner follows
 * the step prop, which changes via dispatch().
 */
import { useCallback, useRef } from 'react';
import { blink } from '../../../lib/blink';
import type { Battle, PlayerBattleResult } from '../battleTypes';
import type { StepAction } from './useBattleStepMachine';
import { executeBattle } from '../../../lib/api';
import { useSoundSetting } from '../../../hooks/useSoundSetting';
import { useTickSound } from '../../../hooks/useTickSound';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Duration constants — change here, all timing adjusts automatically. */
const SPIN_DURATION_MS   = 3500;   // spinner animation duration (must match PackBattleSpinner)
const TICK_DURATION_MS   = 3000;   // decel tick sound (ends ~500ms before spin)
const SETTLE_PAUSE_MS    = 400;    // brief pause after spin lands (settled step)
const REVEAL_ADMIRE_MS   = 1500;   // how long to admire revealed cards
const PRE_SPIN_DELAY_MS  = 600;    // gap between packs (round X idle → spin start)
const WINNER_DELAY_MS    = 500;    // pause before showing winner

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
    launchInFlight.current = true;

    const isHost = user?.id === currentBattle.hostUserId;

    // ── Transition to opening phase ────────────────────────────────────────
    dispatch({ type: 'LOADING' });

    // Non-host clients receive phase updates via polling. Realtime publishes
    // for RESULTS_READY and ROUND_UPDATE are handled below (best-effort).
    // They never call executeBattle.
    if (!isHost || watchOnly) return;

    try {
      console.log(`[useBattleExecution] Executing battle ${battleId}...`);

      // ── Backend determines all results, awards cards, updates balances ──
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

      // ── Store results locally (host drives animation) ──────────────────
      dispatch({ type: 'SET_RESULTS', results: playerResults });

      // ── Animate each round ──────────────────────────────────────────────
      for (let round = 0; round < numPacks; round++) {
        // 1. PRE-SPIN RESET — strip at x=0, waiting for spin to begin
        dispatch({ type: 'SETTLE', round, landing: false });
        await sleep(PRE_SPIN_DELAY_MS);

        // 2. SPINNING — spinner animating, tick sounds playing
        dispatch({ type: 'START_SPIN', round });
        startDecel(TICK_DURATION_MS);

        blink.db.battles.update(battleId, {
          currentRound: round,
          isSpinning: 1
        }).catch(e => console.warn('[useBattleExecution] DB update failed:', e.message));

        await sleep(SPIN_DURATION_MS);

        // 3. POST-SPIN LOCK — strip holds at target, settle ease-out
        dispatch({ type: 'SETTLE', round, landing: true });
        stopTick();

        blink.db.battles.update(battleId, { isSpinning: 0 })
          .catch(e => console.warn('[useBattleExecution] DB update failed:', e.message));

        await sleep(SETTLE_PAUSE_MS);

        // 4. REVEALED — cards visible, totals updated, admire pause
        dispatch({ type: 'REVEAL', round });
        await sleep(REVEAL_ADMIRE_MS);
      }

      // ── WINNER ─────────────────────────────────────────────────────────
      await sleep(WINNER_DELAY_MS);
      // `winnerResult` is authoritative for this execution response. For a
      // legacy response that omitted it, derive the unique best total instead
      // of forcing the footer into a draw.
      const finalWinner = winnerResult || (isDraw ? null : playerResults
        .slice()
        .sort((a, b) => Number(b.totalValue || 0) - Number(a.totalValue || 0))[0] || null);
      dispatch({ type: 'WINNER', winner: finalWinner });

      // The backend finalizes the battle after rewards are committed. Keep a
      // best-effort client update only for animation metadata; never let a
      // failed UI update decide whether rewards were settled.
      await blink.db.battles.update(battleId, {
        status: 'finished',
        endedAt: new Date().toISOString(),
        isSpinning: 0,
      }).catch(e => console.warn('[useBattleExecution] Final DB update failed:', e.message));

      // ── Done — host sees winner, non-host clients pick up via polling ──

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
