import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { useSoundSetting } from '../../hooks/useSoundSetting';
import { useUpgraderAudio } from '../../hooks/useUpgraderAudio';

// ── Circular Success Meter ────────────────────────────────────────────────────
//
// Architecture (source of truth lives HERE):
//   • When `spinning` flips true, CircularMeter rolls the outcome itself using
//     `percent` (the real success chance). It then animates the wheel to land
//     deterministically in the correct zone and calls `onSpinComplete(isWin)`.
//   • The parent hook uses `onSpinComplete` to run DB operations — it never
//     needs to pre-compute or pre-set outcome.
//   • This eliminates the React async state timing race that caused visual/logic
//     mismatches: the animation and the outcome are computed in the same
//     synchronous call, guaranteed to be consistent.
//
// Geometry:
//   • Win arc  = [0 … winDeg] starting at 12 o'clock, going clockwise.
//   • Lose gap = [winDeg … 360°].
//   • Fixed pointer triangle sits at 12 o'clock above the SVG.
//   • The SVG group rotates; when it stops, the zone under the pointer is the result.

export function CircularMeter({
  percent,
  upgrading,
  spinning,
  outcome,
  onSpinComplete,
  forcedOutcome,
}: {
  percent: number;
  upgrading: boolean;
  spinning: boolean;
  outcome: 'win' | 'lose' | null;
  onSpinComplete?: (isWin: boolean) => void;
  /** When provided (from backend), skip internal RNG and use this value directly */
  forcedOutcome?: boolean | null;
}) {
  const R = 80;
  const SIZE = 220;
  const CX = SIZE / 2;
  const circumference = 2 * Math.PI * R;

  // Win arc covers percent% of circumference
  const winDash  = (percent / 100) * circumference;
  const loseDash = circumference - winDash;

  // Dynamic idle color based on percentage
  const baseColor = useMemo(() => {
    if (percent >= 70) return '#10b981';
    if (percent >= 50) return '#facc15';
    if (percent >= 30) return '#f97316';
    return '#ef4444';
  }, [percent]);

  const winColor  = '#10b981';
  const loseColor = '#ef4444';

  const arcColor = useMemo(() => {
    if (outcome === 'win' && !spinning) return winColor;
    if (outcome === 'lose' && !spinning) return loseColor;
    return baseColor;
  }, [outcome, baseColor, spinning]);

  // Motion value for the SVG group rotation (degrees, cumulative)
  const rotation = useMotionValue(0);
  const animRef  = useRef<ReturnType<typeof animate> | null>(null);

  // ── Audio ──
  const { enabled: soundEnabled } = useSoundSetting();
  const { startSuspense, stopSuspense, playWin, playLoss } = useUpgraderAudio(soundEnabled);

  // Shared state between the two effects
  const pendingRef = useRef<{
    cancelled: boolean;
    /** The authoritative backend result — set when forcedOutcome arrives */
    forced: boolean | null;
    /** Resolve function to wake the loop when forcedOutcome arrives */
    resolve?: (v: boolean) => void;
  }>({ cancelled: false, forced: null });

  // Sync forcedOutcome into the ref — this is the ONLY source of truth
  useEffect(() => {
    pendingRef.current.forced = forcedOutcome;
    if (forcedOutcome !== null && pendingRef.current.resolve) {
      pendingRef.current.resolve(forcedOutcome);
    }
  }, [forcedOutcome]);

  // ── Main spin loop + landing animation ───────────────────────────────────
  useEffect(() => {
    // ── Reset ──
    if (!upgrading) {
      if (!outcome) {
        animRef.current?.stop();
        rotation.set(0);
      }
      return;
    }

    // ── Wait for spinning to start ──
    if (!spinning) return;

    // NOTE: Audio is NOT started here — Phase 0 (backend wait) may run for
    // several seconds. The 4.0s suspense sweep is synced to Phase 1+2 (the
    // visible landing animation), not to Phase 0. See the runAnimation
    // paths below where startSuspense() is called.

    // ── Geometry constants (computed once per spin) ─────────────────────
    const winDeg = (percent / 100) * 360;
    const winTarget = winDeg / 2;
    const loseTarget = winDeg + (360 - winDeg) / 2;

    // Check if the backend has already responded
    const currentForced = pendingRef.current.forced;
    const useForced = currentForced !== null;
    const isWin = useForced ? currentForced! : false; // will be set before landing

    const pointerTarget = isWin ? winTarget : loseTarget;
    const requiredMod = ((360 - pointerTarget) % 360 + 360) % 360;

    // Phase timing — total ~3.2s (visible spin from backend-ready)
    const PHASE1_DUR = 1.0 + Math.random() * 0.3;
    const PHASE2_DUR = 3.2 - PHASE1_DUR;

    let cancelled = false;
    pendingRef.current.cancelled = false;
    const setCancelled = () => { cancelled = true; pendingRef.current.cancelled = true; };

    const runAnimation = async () => {
      // ── PHASE 0: Continuous looping while waiting for backend ──────────
      // Refs: rotation accumulates continuously at ~2 full rotations/sec
      const loopSpeed = 720; // degrees per second
      const currentRotation = rotation.get();

      if (!useForced) {
        // Start an indefinite linear loop
        animRef.current = animate(rotation, currentRotation + 360 * 30, {
          duration: 15, // 30 rotations over 15s = 2 rot/s
          ease: 'linear',
        });

        // Wait for the backend to respond
        const forcedResult = await new Promise<boolean>((resolve) => {
          pendingRef.current.resolve = resolve;
          // Also set up a cancellation check interval
          const check = setInterval(() => {
            if (pendingRef.current.cancelled) {
              clearInterval(check);
              pendingRef.current.resolve = undefined;
            }
          }, 100);
        });

        if (cancelled || pendingRef.current.cancelled) return;

        // Stop the loop
        animRef.current?.stop();

        // Recompute landing target with the REAL result
        const realWin = forcedResult;
        const realTarget = realWin ? winTarget : loseTarget;
        const realMod = ((360 - realTarget) % 360 + 360) % 360;

        // ── DEBUG LOG ──────────────────────────────────────────────────
        console.log('[Upgrader Spin]', {
          successChance: `${percent.toFixed(2)}%`,
          backendResult: realWin ? '✅ WIN' : '❌ LOSS',
          landingTarget: `${realTarget.toFixed(2)}°`,
          requiredMod: `${realMod.toFixed(2)}°`,
          authority: 'BACKEND',
        });
        // ────────────────────────────────────────────────────────────────

        // ── PHASE 1: Fast linear transition from wherever we are ────────
        // Start the suspense audio NOW — synced with the visible landing
        startSuspense();

        const phase1Start = rotation.get();
        const spinCount = 4 + Math.floor(Math.random() * 3);
        const phase1End = phase1Start + spinCount * 360;

        animRef.current = animate(rotation, phase1End, {
          duration: PHASE1_DUR,
          ease: 'linear',
        });
        await animRef.current;
        if (cancelled) return;

        // ── PHASE 2: Deceleration to exact target ──────────────────────
        const phase1EndNorm = ((phase1End % 360) + 360) % 360;
        let delta = realMod - phase1EndNorm;
        if (delta < 0) delta += 360;
        const phase2End = phase1End + delta + 2 * 360;

        animRef.current = animate(rotation, phase2End, {
          duration: PHASE2_DUR,
          ease: [0.25, 1, 0.5, 1],
        });
        await animRef.current;
        if (cancelled) return;

        // ── Sound transition ──
        stopSuspense();
        setTimeout(() => { realWin ? playWin() : playLoss(); }, 120);

        // ── Notify parent with the AUTHORITATIVE result ──
        onSpinComplete?.(realWin);

      } else {
        // Backend already responded — go directly to landing with real result
        console.log('[Upgrader Spin]', {
          successChance: `${percent.toFixed(2)}%`,
          backendResult: isWin ? '✅ WIN' : '❌ LOSS',
          landingTarget: `${pointerTarget.toFixed(2)}°`,
          requiredMod: `${requiredMod.toFixed(2)}°`,
          authority: 'BACKEND (instant)',
        });

        // Start suspense audio synced with the visible landing animation
        startSuspense();

        const spinCount = 4 + Math.floor(Math.random() * 3);
        const startDeg = rotation.get();
        const phase1End = startDeg + spinCount * 360;

        animRef.current = animate(rotation, phase1End, {
          duration: PHASE1_DUR,
          ease: 'linear',
        });
        await animRef.current;
        if (cancelled) return;

        const phase1EndNorm = ((phase1End % 360) + 360) % 360;
        let delta = requiredMod - phase1EndNorm;
        if (delta < 0) delta += 360;
        const phase2End = phase1End + delta + 2 * 360;

        animRef.current = animate(rotation, phase2End, {
          duration: PHASE2_DUR,
          ease: [0.25, 1, 0.5, 1],
        });
        await animRef.current;
        if (cancelled) return;

        stopSuspense();
        setTimeout(() => { isWin ? playWin() : playLoss(); }, 120);
        onSpinComplete?.(isWin);
      }
    };

    runAnimation();

    return () => {
      setCancelled();
      animRef.current?.stop();
      stopSuspense();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, upgrading]);
  // NOTE: intentionally exclude `percent` and `onSpinComplete` from deps.
  // `percent` must not change mid-spin (parent should lock it). `onSpinComplete`
  // is a stable callback ref from the hook. Re-adding them would re-trigger the
  // effect and restart the animation mid-flight.

  // Cleanup on unmount
  useEffect(() => () => animRef.current?.stop(), []);

  // Pointer color & glow
  const pointerColor = (outcome === 'win' && !spinning)
    ? winColor
    : (outcome === 'lose' && !spinning)
    ? loseColor
    : '#ffffff';
  const pointerGlow = `drop-shadow(0 0 8px ${pointerColor})`;

  // Outer ring glow on result
  const resultGlow = (outcome === 'win' && !spinning)
    ? `0 0 60px ${winColor}80, 0 0 20px ${winColor}40`
    : (outcome === 'lose' && !spinning)
    ? `0 0 30px ${loseColor}40`
    : 'none';

  return (
    <div className="relative flex flex-col items-center select-none" style={{ width: SIZE + 24 }}>

      {/* ── Fixed pointer triangle at 12 o'clock ── */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          borderTop: `18px solid ${pointerColor}`,
          filter: pointerGlow,
          transition: 'border-top-color 0.4s ease, filter 0.4s ease',
          marginBottom: 4,
          flexShrink: 0,
          zIndex: 30,
        }}
      />

      {/* ── Outer container with result glow ── */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          boxShadow: resultGlow,
          transition: 'box-shadow 0.6s ease',
        }}
      >
        {/* ── SVG ring — the ArcGroup inside rotates as the wheel ── */}
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 z-10"
          style={{ overflow: 'visible' }}
        >
          {/* Static dark track */}
          <circle
            cx={CX} cy={CX} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="11"
          />

          {/* Rotating arc group — subscribes to motion value imperatively */}
          <ArcGroup
            cx={CX}
            cy={CX}
            r={R}
            winDash={winDash}
            loseDash={loseDash}
            circumference={circumference}
            arcColor={arcColor}
            outcome={outcome}
            rotation={rotation}
          />
        </svg>

        {/* ── Center percentage text ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <motion.div
            animate={(outcome === 'win' && !spinning) ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-1"
          >
            <span
              className="font-display text-5xl leading-none tabular-nums"
              style={{
                color: arcColor,
                textShadow: (outcome === 'win' && !spinning)
                  ? `0 0 24px ${winColor}, 0 0 48px ${winColor}60`
                  : 'none',
                transition: 'color 0.4s ease, text-shadow 0.4s ease',
              }}
            >
              {percent.toFixed(1)}%
            </span>

            <AnimatePresence mode="wait">
              <motion.span
                key={spinning ? 'spinning' : (outcome ?? 'idle')}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-[11px] uppercase tracking-widest font-bold"
                style={{
                  color: (outcome === 'win' && !spinning)
                    ? winColor
                    : (outcome === 'lose' && !spinning)
                    ? loseColor
                    : '#6b7280',
                }}
              >
                {spinning
                  ? 'Spinning...'
                  : outcome === 'win'
                  ? '✓ Winner!'
                  : outcome === 'lose'
                  ? '✗ Failed'
                  : 'Success Chance'}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── ArcGroup: draws win/lose arc segments, subscribes to rotation imperatively ──
function ArcGroup({
  cx, cy, r,
  winDash, loseDash, circumference,
  arcColor, outcome,
  rotation,
}: {
  cx: number; cy: number; r: number;
  winDash: number; loseDash: number; circumference: number;
  arcColor: string; outcome: 'win' | 'lose' | null;
  rotation: ReturnType<typeof useMotionValue<number>>;
}) {
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    // Set initial position (arc starts at 12 o'clock = SVG -90°)
    if (groupRef.current) {
      groupRef.current.setAttribute('transform', `rotate(${rotation.get() - 90} ${cx} ${cy})`);
    }
    const unsub = rotation.on('change', (deg) => {
      if (groupRef.current) {
        groupRef.current.setAttribute('transform', `rotate(${deg - 90} ${cx} ${cy})`);
      }
    });
    return unsub;
  }, [rotation, cx, cy]);

  const winColor  = '#10b981';
  const loseArcColor = outcome === 'lose' ? '#7f1d1d' : '#ef444420';

  return (
    <g ref={groupRef}>
      {/* WIN arc (green) */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={arcColor}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${winDash} ${circumference}`}
        strokeDashoffset={0}
        style={{
          filter: outcome === 'win'
            ? `drop-shadow(0 0 16px ${winColor}) drop-shadow(0 0 6px ${winColor})`
            : `drop-shadow(0 0 8px ${arcColor}80)`,
          transition: 'stroke 0.4s ease, filter 0.4s ease',
        }}
      />
      {/* LOSE arc (subtle dark red gap) */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={loseArcColor}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${loseDash} ${circumference}`}
        strokeDashoffset={-winDash}
        style={{
          filter: outcome === 'lose' ? `drop-shadow(0 0 8px #ef444460)` : 'none',
          transition: 'stroke 0.4s ease',
        }}
      />
    </g>
  );
}
