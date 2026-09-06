/**
 * useBattleState — single source of truth for Pack Battle state.
 *
 * Internally delegates to useBattleStepMachine (one reducer for all
 * animation state).  Exposes both the new step + dispatch and legacy
 * derived properties so BattleRoom.tsx and useBattleRoom.ts don't
 * need massive rewrites.
 *
 * All external state updates come through one of two paths:
 *   1. Host: useBattleExecution dispatches actions directly (fast)
 *   2. Non-host: realtime events + DB polling dispatch the same actions
 *
 * Both paths feed the same reducer, so they always produce identical
 * UI state given the same action sequence.
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  blink,
  BATTLE_CHANNEL_PREFIX,
  BATTLE_EVENTS
} from '../../../lib/blink';
import type { Battle, BattlePlayer, PlayerBattleResult } from '../battleTypes';
import { fetchBattleStateAPI } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import {
  useBattleStepMachine,
  derivePhase,
  deriveCurrentRound,
  deriveIsRoundSpinning,
  deriveRevealIndex,
  deriveShowWinner,
} from './useBattleStepMachine';

export const useBattleState = (battleId: string) => {
  const { user } = useAuth();
  const { state, dispatch, stepRef } = useBattleStepMachine();

  const [battle, setBattle]       = useState<Battle | null>(null);
  const [players, setPlayers]     = useState<BattlePlayer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [packCardsMap, setPackCardsMap] = useState<Record<string, any[]>>({});
  const [battleError]             = useState('');

  const battleRef    = useRef<Battle | null>(null);
  const subInProgress = useRef<string | null>(null);
  const mountedRef   = useRef(true);
  const finishSyncRef = useRef<string | null>(null);
  const resultsRef   = useRef(state.results);
  const nonHostAnimatingRef = useRef(false);
  const nonHostCountdownRef = useRef(false);

  // Keep resultsRef in sync so fetchBattleState doesn't depend on state.results.length
  useEffect(() => { resultsRef.current = state.results; }, [state.results]);

  // ── Non-host countdown driver ─────────────────────────────────────────
  // The host runs a local 3→2→1→LOADING sequence (useBattleLogic.ts:47-55)
  // but never publishes COUNTDOWN_UPDATE realtime events.  The non-host
  // only gets one COUNTDOWN(3) from polling, freezes at "3", then jumps
  // to loading when the DB flips to 'live'.
  //
  // This effect starts a one-shot countdown when battle.status becomes
  // 'starting'.  Once started, the countdown runs to completion even if
  // battle.status changes mid-flight — no cleanup on dep change (only
  // on unmount via mountedRef).
  useEffect(() => {
    if (!battle) return;
    if (!user) return;
    if (battle.status !== 'starting') return;
    if (user.id === battle.hostUserId) return;
    if (nonHostCountdownRef.current) return;
    if (nonHostAnimatingRef.current) return;

    nonHostCountdownRef.current = true;

    const run = async () => {
      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
      try {
        dispatch({ type: 'COUNTDOWN', countdown: 3 });
        await sleep(900);
        if (!mountedRef.current) return;
        dispatch({ type: 'COUNTDOWN', countdown: 2 });
        await sleep(900);
        if (!mountedRef.current) return;
        dispatch({ type: 'COUNTDOWN', countdown: 1 });
        await sleep(900);
        if (!mountedRef.current) return;
        dispatch({ type: 'LOADING' });
      } catch (_) {
        /* non-critical */
      } finally {
        nonHostCountdownRef.current = false;
      }
    };

    run();
  }, [battle?.status, user?.id]);

  // ── Non-host animation driver ──────────────────────────────────────────
  // When a joined (non-host) user receives real card results, drive the
  // spinner animation locally with the same timing constants as the host.
  //
  // This now OWNS the step machine for non-hosts: it dispatches every
  // state transition (resetting the step away from countdown on start).
  // No polling round sync or realtime event can touch the step while
  // this is running — the ref guard blocks them.
  useEffect(() => {
    if (!state.resultsReady) return;
    if (!battleRef.current) return;
    if (state.results.length === 0) return;

    const isHost = user?.id === battleRef.current.hostUserId;
    if (isHost) return;
    if (nonHostAnimatingRef.current) return;

    // Block all external dispatches (polling & realtime) from now on
    nonHostAnimatingRef.current = true;

    // Never restart animation if winner already shown (finished block
    // may re-dispatch SET_RESULTS which re-triggers this effect)
    if (stepRef.current?.type === 'winner') { nonHostAnimatingRef.current = false; return; }

    // Wait for real card data — the polling loop re-dispatches SET_RESULTS
    // when cardsJson transitions from [] to populated, which triggers this
    // effect again (state.results changes).  Without real cards the spinner
    // shows "?" placeholders.
    const hasRealCards = state.results.some(r => r.cards && r.cards.length > 0);
    if (!hasRealCards) { nonHostAnimatingRef.current = false; return; }

    const localMounted = { current: true };

    const runAnimation = async () => {
      let battlePacks: any[] = [];
      try {
        battlePacks = JSON.parse(battleRef.current?.packsJson || '[]');
      } catch {
        console.warn('[useBattleState] Invalid packsJson during animation.');
      }
      const numPacks = battlePacks.length;
      if (numPacks === 0) { nonHostAnimatingRef.current = false; return; }

      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

      try {
        // ── Force exit from countdown / idle / loading into the
        //     animation sequence.  The first SETTLE(landing=false)
        //     resets the strip to x=0 even if polling already moved
        //     us to spinning/settled.
        dispatch({ type: 'SETTLE', round: 0, landing: false });
        await sleep(600);

        for (let round = 0; round < numPacks; round++) {
          if (!localMounted.current) return;

          // 2. Spinning
          dispatch({ type: 'START_SPIN', round });
          await sleep(3500);

          if (!localMounted.current) return;

          // 3. Post-spin lock
          dispatch({ type: 'SETTLE', round, landing: true });
          await sleep(400);

          if (!localMounted.current) return;

          // 4. Revealed
          dispatch({ type: 'REVEAL', round });
          await sleep(1500);

          if (!localMounted.current) return;

          // 5. Pre-spin reset for next round (skip on last)
          if (round < numPacks - 1) {
            dispatch({ type: 'SETTLE', round: round + 1, landing: false });
            await sleep(600);
          }
        }

        if (!localMounted.current) return;

        // 6. Winner (null = draw — no one had isWinner flag set)
        await sleep(500);
        const latestResults = resultsRef.current;
        const w = latestResults.find(r => r.isWinner) || null;
        dispatch({ type: 'WINNER', winner: w });
      } catch (err) {
        console.error('[useBattleState] Non-host animation error:', err);
      } finally {
        nonHostAnimatingRef.current = false;
      }
    };

    runAnimation();

    return () => {
      localMounted.current = false;
      nonHostAnimatingRef.current = false;
    };
  }, [state.resultsReady, state.results]);

  // Derive legacy properties from step (backward compat with BattleRoom.tsx)
  const { step } = state;
  const phase          = derivePhase(step);
  const currentRound   = deriveCurrentRound(step);
  const isRoundSpinning = deriveIsRoundSpinning(step);
  const revealIndex    = deriveRevealIndex(step);
  const showWinner     = deriveShowWinner(step);
  const winner         = step.type === 'winner' ? step.winner : null;

  // ── Fetch battle state from DB (used by polling + initial load) ───────────
  const fetchBattleState = useCallback(async () => {
    // The room snapshot is a protected backend read. Waiting here avoids an
    // unauthenticated request during the managed-auth bootstrap and lets the
    // callback re-run as soon as the session becomes available.
    if (!user) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    try {
      const stateResult = await fetchBattleStateAPI(battleId);
      const b = stateResult.battle;
      if (!b || !mountedRef.current) return;

      const normalBattle: Battle = {
        ...b,
        mode:         b.mode || 'standard',
        packsJson:    b.packsJson || b.packs_json || '[]',
        isPublic:     Number(b.isPublic) > 0,
        totalCost:    Number(b.totalCost),
        playerCount:  Number(b.playerCount),
        currentRound: Number(b.currentRound || 0),
        isSpinning:   Number(b.isSpinning || 0) > 0,
        teamMode: Number(b.teamMode || b.team_mode) > 0,
        players: [],
      };
      setBattle(normalBattle);
      battleRef.current = normalBattle;

      // ── Use the backend's single authenticated state snapshot ─────────────
      // This avoids direct core DB calls from preview origins and keeps battle,
      // players, and pack cards on the same read boundary.
      let battlePacks: any[] = [];
      try {
        battlePacks = JSON.parse(normalBattle.packsJson || '[]');
      } catch {
        console.warn('[useBattleState] Invalid packsJson; using empty pack list.');
      }
      if (Object.keys(packCardsMap).length === 0 && stateResult.packCards.length > 0) {
        const newMap = Object.fromEntries(
          [...new Set(battlePacks.map((p: any) => p.id).filter(Boolean))].map((pid: any) => [
            pid,
            stateResult.packCards.filter((card: any) => card.packId === pid),
          ])
        );
        setPackCardsMap(newMap);
      }

      // ── Fetch players ────────────────────────────────────────────────────
      const rawPlayers = (stateResult.players || []) as any[];
      const normalPlayers: BattlePlayer[] = rawPlayers.filter(Boolean).map((p: any) => ({
        ...p,
        isAi:       Number(p.isAi || p.is_ai) > 0,
        totalValue: Number(p.totalValue || p.total_value || 0),
        isWinner:   Number(p.isWinner || p.is_winner) > 0,
        teamSide: p.teamSide || p.team_side || null,
        cardsJson: p.cardsJson || p.cards_json,
      }));
      setPlayers(normalPlayers);

      // ── Recover from missed realtime events via DB polling ───────────────
      // During 'live' status, only sync round/spinning if we're behind.
      // Never set results or revealIndex from DB (cards leak).
      if (normalBattle.status === 'live') {
        // Populate results from DB cardsJson so non-host clients see real
        // card data during animation (not empty shells).
        if (resultsRef.current.length === 0 || normalPlayers.some(p => {
          const existing = resultsRef.current.find(r => r.playerId === p.id);
          const cardsLen = JSON.parse(p.cardsJson || '[]').length;
          return cardsLen > 0 && (existing?.cards?.length || 0) < cardsLen;
        })) {
          dispatch({
            type: 'SET_RESULTS',
            results: normalPlayers.map(p => ({
              playerId: p.id,
              teamSide: p.teamSide,
              userId:   p.userId,
              username: p.username,
              avatar:   p.avatar,
              isAi:     p.isAi,
              cards:    JSON.parse(p.cardsJson || '[]'),
              totalValue: p.totalValue,
              isWinner: p.isWinner,
            })),
          });
        }

        // Sync currentRound from DB only if we're behind (joiner catching up).
        // Skip entirely while local non-host animation is running — the
        // animation driver owns the step machine and polling would overwrite.
        if (nonHostAnimatingRef.current || finishSyncRef.current === battleId) return;
        const dbRound = normalBattle.currentRound;
        const currentStep = stepRef.current;
        if (
          currentStep.type === 'idle' ||
          currentStep.type === 'countdown' ||
          (currentStep.type === 'revealed' && dbRound > currentStep.round)
        ) {
          // We're behind — infer step from DB state
          if (normalBattle.isSpinning) {
            dispatch({ type: 'START_SPIN', round: dbRound });
          } else {
            // Not spinning → either pre-spin or post-spin
            // Use landing=true to lock strip (conservative: don't reset mid-battle)
            dispatch({ type: 'SETTLE', round: dbRound, landing: true });
          }
        }
      }

      // ── Finished: authoritative final sync ───────────────────────────────
      // The backend marks a battle finished before the host's presentation
      // animation completes. Do not let polling interrupt that animation with
      // an early WINNER action; a refreshed room still syncs normally because
      // it has no local result sequence in progress.
      const presentationInProgress = ['loading', 'spinning', 'settled', 'revealed']
        .includes(stepRef.current.type);
      const localAnimationActive = resultsRef.current.length > 0 &&
        ['spinning', 'settled', 'revealed'].includes(stepRef.current.type);
      if (normalBattle.status === 'finished' && !presentationInProgress && !localAnimationActive) {
        finishSyncRef.current = battleId;
        const dbResults: PlayerBattleResult[] = normalPlayers.map(p => ({
          playerId:   p.id,
          teamSide:   p.teamSide,
          userId:     p.userId,
          username:   p.username,
          avatar:     p.avatar,
          isAi:       p.isAi,
          cards:      JSON.parse(p.cardsJson || '[]'),
          totalValue: p.totalValue,
          isWinner:   p.isWinner,
        }));
        dispatch({ type: 'SET_RESULTS', results: dbResults });
        const dbWinner = dbResults.find(r => r.isWinner) || null;
        // Older completed battles may have cards and totals persisted while
        // winner flags were lost. Recover the display winner deterministically
        // so the footer never disappears or falls back to DRAW.
        const totals = dbResults.map(r => Math.round(Number(r.totalValue || 0) * 100));
        const bestTotal = normalBattle.mode === 'underdog' ? Math.min(...totals) : Math.max(...totals);
        const recoveredWinner = dbWinner || (
          normalBattle.mode !== 'shared'
          && totals.length > 1
          && totals.filter(total => total === bestTotal).length === 1
            ? dbResults[totals.indexOf(bestTotal)]
            : null
        );
        dispatch({
          type: 'WINNER',
          winner: recoveredWinner,
        });
      }

      // ── Phase transitions (status-driven) ────────────────────────────────
      if (normalBattle.status === 'starting' && stepRef.current.type === 'idle') {
        dispatch({ type: 'COUNTDOWN', countdown: 3 });
      }
      if (normalBattle.status === 'live' && stepRef.current.type === 'idle') {
        dispatch({ type: 'LOADING' });
      }
      // Finished status is handled above with an authoritative WINNER action.
      // Do not allow the generic phase transitions to overwrite it.
    } catch (e) {
      console.error('[useBattleState] fetchBattleState error:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [battleId, dispatch, stepRef, packCardsMap, user]);

  // ── Polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBattleState();
    const intervalTime =
      phase === 'opening' || phase === 'countdown' || battle?.status === 'live'
        ? 2000
        : 5000;
    const iv = setInterval(fetchBattleState, intervalTime);
    return () => clearInterval(iv);
  }, [fetchBattleState, phase, battle?.status]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!battleId || !user || subInProgress.current === battleId) return;

    let mounted = true;
    let unsubFn: (() => void) | null = null;
    let retryCount = 0;

    const sub = async () => {
      if (!mounted) return;

      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!mounted) return;
      }

      subInProgress.current = battleId;
      try {
        console.log(`[Realtime] Subscribing to battle ${battleId} (attempt ${retryCount + 1})`);
        unsubFn = await blink.realtime.subscribe(
          `${BATTLE_CHANNEL_PREFIX}-${battleId}`,
          (msg) => {
            if (!mounted) return;
            // During non-host local countdown or animation, block ALL
            // realtime dispatches.  They carry stale timing data that
            // would reset the step or re-trigger the countdown.
            if (nonHostAnimatingRef.current || nonHostCountdownRef.current) return;
            const data = msg.data as any;

            switch (msg.event) {
              case BATTLE_EVENTS.PHASE_CHANGE:
                if (data.phase === 'countdown')  dispatch({ type: 'COUNTDOWN', countdown: 3 });
                if (data.phase === 'opening')    dispatch({ type: 'LOADING' });
                if (data.phase === 'results')     dispatch({ type: 'WINNER', winner: null });
                break;

              case BATTLE_EVENTS.COUNTDOWN_UPDATE:
                dispatch({ type: 'COUNTDOWN', countdown: data.countdown });
                break;

              case BATTLE_EVENTS.RESULTS_READY:
                dispatch({ type: 'SET_RESULTS', results: data.results });
                break;

              case BATTLE_EVENTS.ROUND_UPDATE: {
                const round = data.round as number;
                if (data.isSpinning === true) {
                  dispatch({ type: 'START_SPIN', round });
                } else {
                  // isSpinning=false + revealIndex matches round → revealed
                  if (data.revealIndex === round) {
                    dispatch({ type: 'REVEAL', round });
                  } else {
                    // Pre-spin reset: landing=false (strip at x=0)
                    dispatch({ type: 'SETTLE', round, landing: false });
                  }
                }
                break;
              }

              case BATTLE_EVENTS.BATTLE_FINISHED:
                // Backend completion can arrive while the final strip is still
                // travelling. Never let realtime reveal the banner early.
                if (!['loading', 'spinning', 'settled', 'revealed'].includes(stepRef.current.type)) {
                  dispatch({ type: 'WINNER', winner: data.winner });
                }
                break;

              case BATTLE_EVENTS.BATTLE_CANCELED:
                window.location.reload();
                break;
            }
          }
        );
        console.log(`[Realtime] Subscribed to battle ${battleId}`);
        retryCount = 0;
      } catch (err: any) {
        const isTimeout =
          err?.message?.includes('timeout') || err?.name === 'BlinkRealtimeError';
        if (isTimeout) {
          console.warn(`[Realtime] Battle ${battleId} subscription timed out (attempt ${retryCount + 1}).`);
        } else {
          console.error(`[Realtime] Battle ${battleId} sub error:`, err);
        }
        subInProgress.current = null;
        if (mounted && retryCount < 3) {
          const delay = Math.min(2000 * Math.pow(2, retryCount), 15000);
          retryCount++;
          setTimeout(sub, delay);
        }
      }
    };

    sub();

    return () => {
      mounted = false;
      mountedRef.current = false;
      subInProgress.current = null;
      if (unsubFn) unsubFn();
    };
  }, [battleId, user, dispatch]);

  return {
    // Core state
    battle,
    players,
    loading,
    packCardsMap,
    battleError,

    // Step machine (new — used by useBattleExecution)
    battleStep:  state.step,
    results:     state.results,
    resultsReady: state.resultsReady,
    dispatch,

    // Derived (backward compat — used by BattleRoom.tsx)
    phase,
    countdown:    step.type === 'countdown' ? step.countdown : 0,
    currentRound,
    isRoundSpinning,
    revealIndex,
    showWinner,
    winner,

    // Refs
    battleRef,
    stepRef,
    fetchBattleState,

    // Setters (legacy — used by useBattleLogic for countdown)
    setPhase:   () => {},  // no-op; phase is derived from step
    setCountdown: (n: number) => dispatch({ type: 'COUNTDOWN', countdown: n }),
    setResults:   (r: PlayerBattleResult[]) => dispatch({ type: 'SET_RESULTS', results: r }),
    setWinner:    (w: PlayerBattleResult | null) => dispatch({ type: 'WINNER', winner: w }),
    setRevealIndex: () => {},
    setCurrentRound: () => {},
    setIsRoundSpinning: () => {},
  };
};
