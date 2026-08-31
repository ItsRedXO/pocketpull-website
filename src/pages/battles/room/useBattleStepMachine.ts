/**
 * useBattleStepMachine — single reducer for all Pack Battle animation state.
 *
 * ONE source of truth: the step drives what the spinner does, what cards are
 * visible, when totals update, and when the winner appears.
 *
 * Valid state graph:
 *   idle → countdown(N) → loading → spinning(0) → settled(0) → revealed(0)
 *        → spinning(1) → settled(1) → revealed(1) → … → winner
 */
import { useCallback, useRef, useReducer } from 'react';
import type { BattleStep, PlayerBattleResult, Phase } from '../battleTypes';
import { IDLE_STEP } from '../battleTypes';

// ── Reducer ────────────────────────────────────────────────────────────────

export type StepAction =
  | { type: 'COUNTDOWN'; countdown: number }
  | { type: 'LOADING' }
  | { type: 'SET_RESULTS'; results: PlayerBattleResult[] }
  | { type: 'START_SPIN'; round: number }
  | { type: 'SETTLE'; round: number; landing: boolean }   // landing=false: pre-spin reset; landing=true: post-spin lock
  | { type: 'REVEAL'; round: number }
  | { type: 'WINNER'; winner: PlayerBattleResult | null }
  | { type: 'RESET' };

export interface BattleStepState {
  step: BattleStep;
  results: PlayerBattleResult[];
  resultsReady: boolean;   // cards have arrived from backend
}

export const INITIAL_STATE: BattleStepState = {
  step: IDLE_STEP,
  results: [],
  resultsReady: false,
};

export function battleStepReducer(
  state: BattleStepState,
  action: StepAction
): BattleStepState {
  switch (action.type) {
    case 'COUNTDOWN':
      return { ...state, step: { type: 'countdown', countdown: action.countdown } };

    case 'LOADING':
      return { ...state, step: { type: 'loading' } };

    case 'SET_RESULTS':
      return { ...state, results: action.results, resultsReady: true };

    case 'START_SPIN': {
      // Guard: never start spinning unless cards have arrived
      if (!state.resultsReady) return state;
      return { ...state, step: { type: 'spinning', round: action.round } };
    }

    case 'SETTLE':
      return { ...state, step: { type: 'settled', round: action.round, landing: action.landing } };

    case 'REVEAL':
      return { ...state, step: { type: 'revealed', round: action.round } };

    case 'WINNER':
      return { ...state, step: { type: 'winner', winner: action.winner } };

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ── Derived helpers (pure — no side effects) ────────────────────────────────

/** Legacy Phase for BattleRoom conditional rendering. */
export function derivePhase(step: BattleStep): Phase {
  switch (step.type) {
    case 'idle':        return 'lobby';
    case 'countdown':   return 'countdown';
    case 'winner':      return 'results';
    default:            return 'opening';  // loading | spinning | settled | revealed
  }
}

/** Current pack index (0-based). */
export function deriveCurrentRound(step: BattleStep): number {
  return step.type === 'spinning' || step.type === 'settled' || step.type === 'revealed'
    ? step.round
    : 0;
}

/** Whether the spinner should be animating right now. */
export function deriveIsRoundSpinning(step: BattleStep): boolean {
  return step.type === 'spinning';
}

/** Index of the last fully revealed pack (-1 = none revealed yet). */
export function deriveRevealIndex(step: BattleStep): number {
  if (step.type === 'revealed') return step.round;
  if (step.type === 'winner')   return Infinity;  // all packs revealed
  return -1;
}

/** Whether all revealed packs are visible (winner step). */
export function deriveShowWinner(step: BattleStep): boolean {
  return step.type === 'winner';
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useBattleStepMachine() {
  const [state, rawDispatch] = useReducer(battleStepReducer, INITIAL_STATE);
  const stepRef = useRef<BattleStep>(state.step);

  // Keep ref in sync so closures (e.g. realtime handlers) always read current step
  const dispatch = useCallback((action: StepAction) => {
    rawDispatch(action);
    // Manually compute next step for the ref (mirrors reducer logic)
    switch (action.type) {
      case 'COUNTDOWN':
        stepRef.current = { type: 'countdown', countdown: action.countdown };
        break;
      case 'LOADING':
        stepRef.current = { type: 'loading' };
        break;
      case 'START_SPIN':
        stepRef.current = { type: 'spinning', round: action.round };
        break;
      case 'SETTLE':
        stepRef.current = { type: 'settled', round: action.round, landing: action.landing };
        break;
      case 'REVEAL':
        stepRef.current = { type: 'revealed', round: action.round };
        break;
      case 'WINNER':
        stepRef.current = { type: 'winner', winner: action.winner };
        break;
      case 'RESET':
        stepRef.current = IDLE_STEP;
        break;
      // SET_RESULTS doesn't change step, skip ref update
    }
  }, []);

  return { state, dispatch, stepRef };
}
