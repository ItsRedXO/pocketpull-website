import { useState, useEffect, useCallback, useRef } from 'react';
import { useBattleExecution } from './useBattleExecution';
import type { StepAction } from './useBattleStepMachine';
import { startBattleCountdown as startBattleAPI } from '../../../lib/api';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useBattleLogic = ({
  battleId,
  battle,
  players,
  user,
  watchOnly,
  dispatch,
  battleRef,
  qc
}: {
  battleId: string;
  battle: any;
  players: any[];
  user: any;
  watchOnly: boolean;
  dispatch: (action: StepAction) => void;
  battleRef: any;
  qc: any;
}) => {
  const [aiCountdown, setAiCountdown] = useState<number | null>(null);
  const [aiTimerFinished, setAiTimerFinished] = useState(false);
  const hasRun = useRef(false);
  const aiTimerDone = useRef(false); // once true, never resets for this battle

  const { launchBattle } = useBattleExecution({
    battleId,
    user,
    watchOnly,
    dispatch,
    qc
  });

  const startBattleCountdown = useCallback(async () => {
    if (hasRun.current) return;
    hasRun.current = true;

    try {
      console.log(`[useBattleLogic] Host starting battle countdown for ${battleId}`);
      await startBattleAPI(battleId);
      
      dispatch({ type: 'COUNTDOWN', countdown: 3 });
      
      for (let i = 3; i >= 1; i--) {
        dispatch({ type: 'COUNTDOWN', countdown: i });
        await sleep(900);
      }
      
      if (battleRef.current) {
        await launchBattle(battleRef.current);
      }
    } catch (err: any) {
      console.error('[useBattleLogic] startBattleCountdown error:', err);
      hasRun.current = false;
    }
  }, [battleId, dispatch, launchBattle, battleRef]);

  const isPlayerInBattle = user?.id === battle?.hostUserId
    || (players || []).some(p => p.userId === user?.id);

  useEffect(() => {
    if (!battle || battle.status !== 'waiting' || watchOnly) return;
    const openSlots = 4 - (players?.length || 0);
    if (openSlots <= 0) return;
    
    if (!isPlayerInBattle) return;

    // The initial battle and player records are fetched independently. The old
    // effect did not depend on players, so it often ran once while players was
    // still [] and returned permanently. Re-run when this user's membership is
    // confirmed, but not when another player joins (the ref keeps the timer one-shot).
    // One-time 5-second timer — only fires once per battle.
    // After it finishes, aiTimerDone stays true so the host can add
    // bots immediately without re-entering the cooldown.
    if (aiTimerDone.current) {
      setAiCountdown(null);
      setAiTimerFinished(true);
      return;
    }

    let seconds = 5;
    setAiCountdown(seconds);
    setAiTimerFinished(false);
    const iv = setInterval(() => {
      seconds -= 1;
      setAiCountdown(seconds);
      if (seconds <= 0) { 
        clearInterval(iv); 
        setAiCountdown(null); 
        setAiTimerFinished(true);
        aiTimerDone.current = true;
      }
    }, 1000);
    return () => { clearInterval(iv); };
    // Only react to battle.id — NOT player count, so adding a bot
    // doesn't restart the timer.
  }, [battle?.id, battle?.status, isPlayerInBattle, watchOnly]);

  useEffect(() => {
    if (!battle || battle.status !== 'waiting' || watchOnly) return;
    const GLOBAL_MAX = 4;
    const effectiveMax = Math.min(battle.playerCount || 2, GLOBAL_MAX);
    if (battle.teamMode === true || (battle as any).teamMode === 1) {
      const leftCount = players.filter(p => p.teamSide === 'left').length;
      const rightCount = players.filter(p => p.teamSide === 'right').length;
      if (leftCount !== 2 || rightCount !== 2) return;
    } else if ((players?.length || 0) < effectiveMax) return;

    const isHost = user?.id === battle.hostUserId;
    if (!isHost) return;

    console.log(`[useBattleLogic] Host driving battle start for ${battle.id}`);
    startBattleCountdown();
  }, [(players?.length || 0), battle?.playerCount, battle?.status, battle, startBattleCountdown, user?.id, watchOnly]);

  return {
    aiCountdown,
    aiTimerFinished,
    startBattleCountdown
  };
};
