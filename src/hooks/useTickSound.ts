/**
 * src/hooks/useTickSound.ts
 *
 * Provides a sharp, percussive "tick" sound for pack reel animations.
 *
 * The tick is a 25 ms synthesised WAV click (blob URL) — no external
 * file is fetched, so latency is near-zero. Playback uses Howler.js
 * with `html5: true` so each individual .play() fires instantly
 * (no Web Audio decode buffer).
 *
 * Two animation modes:
 *  1. `startReel(durationMs, totalDistancePx, tileWidthPx)` —
 *     RAF-based reel-position tracker for PackSpinner. Fires a tick
 *     each time a card tile passes under the center hairline.
 *  2. `startDecel(durationMs)` —
 *     Simulated reel-spin for PackOpeningModal (card-flip UX). Fires
 *     ticks at an exponentially decelerating rate over the duration.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';

/* ------------------------------------------------------------------ */
/*  Generate a sharp, high-pitched 25 ms click WAV blob                */
/*  (PCM 16-bit mono 44100 Hz)                                        */
/* ------------------------------------------------------------------ */

function buildTickBlobUrl(): string {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * 0.015); // 15 ms — sharper click
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const v = new DataView(buf);

  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + numSamples * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 600); // very fast decay
    const sig =
      (Math.sin(2 * Math.PI * 8000 * t) * 0.6 +
        Math.sin(2 * Math.PI * 12000 * t) * 0.3 +
        (Math.random() * 2 - 1) * 0.1) *
      env *
      0.85;
    v.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, sig)) * 0x7fff,
      true
    );
  }

  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let _blobUrl = '';
function getTickBlobUrl(): string {
  if (!_blobUrl) _blobUrl = buildTickBlobUrl();
  return _blobUrl;
}

/* ------------------------------------------------------------------ */
/*  Singleton Howl — Web Audio API (html5: false) to decode blob WAV  */
/* ------------------------------------------------------------------ */

let tickHowl: Howl | null = null;

function ensureTickHowl(): Howl {
  if (!tickHowl) {
    const url = getTickBlobUrl();
    tickHowl = new Howl({
      src: [url],
      format: ['wav'],
      loop: false,
      volume: 0.65,
      html5: false,            // Web Audio API — can decode blob WAVs
      preload: true,
      pool: 8,                 // 8 concurrent playback nodes for rapid-fire ticks
      onload: () => console.log('[TICK] howl loaded — buffer decoded'),
      onloaderror: (_id, err) => console.error('[TICK] howl load error', err),
      onplayerror: (_id, err) => console.error('[TICK] howl play error', err),
    });
  }
  return tickHowl;
}

/** Fire a single tick. Low-overhead — safe to call at 60+ fps. */
function fireTick() {
  const h = ensureTickHowl();
  h.play();
}

/* ------------------------------------------------------------------ */
/*  RAF-based reel tracker for synced tile-passing ticks              */
/* ------------------------------------------------------------------ */

interface ReelTracker {
  start(): void;
  stop(): void;
}

function createReelTracker(
  durationMs: number,
  totalDistancePx: number,
  tileWidthPx: number,
  onTilePassed: () => void
): ReelTracker {
  let animationId: number | null = null;
  let startTime: number | null = null;
  let lastReportedTile = 0;

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(now: number) {
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = easeOutCubic(progress);
    const currentDistance = totalDistancePx * eased;
    const currentTile = Math.floor(currentDistance / tileWidthPx);

    // Fire tick each time we cross a tile boundary
    if (currentTile > lastReportedTile) {
      onTilePassed();
      lastReportedTile = currentTile;
    }

    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      animationId = null;
    }
  }

  return {
    start() {
      startTime = null;
      lastReportedTile = 0;
      animationId = requestAnimationFrame(animate);
    },
    stop() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Decelerating schedule for PackOpeningModal card-flip              */
/* ------------------------------------------------------------------ */

function buildDecelSchedule(
  durationMs: number,
  initialIntervalMs: number
): number[] {
  const delays: number[] = [];
  let acc = 0;
  let interval = initialIntervalMs;

  while (acc < durationMs) {
    delays.push(interval);
    acc += interval;
    // Exponential deceleration: interval increases over time
    interval *= 1.08;
  }

  return delays;
}

/* ------------------------------------------------------------------ */
/*  React hook                                                         */
/* ------------------------------------------------------------------ */

export function useTickSound(soundEnabled: boolean): {
  /** PackSpinner: RAF-based reel-position tracker. */
  startReel: (durationMs: number, totalDistancePx: number, tileWidthPx: number) => void;
  /** PackOpeningModal: decelerating tick schedule. */
  startDecel: (durationMs: number) => void;
  /** Stop either mode immediately. */
  stop: () => void;
  /** Short blip for the Test Sound button. */
  test: () => void;
} {
  const reelRef = useRef<ReelTracker | null>(null);
  const decelTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const enabledRef = useRef(soundEnabled);

  useEffect(() => {
    enabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const stopAll = useCallback(() => {
    // Cancel reel tracker
    if (reelRef.current) {
      reelRef.current.stop();
      reelRef.current = null;
    }
    // Cancel all decel timers
    for (const id of decelTimers.current) clearTimeout(id);
    decelTimers.current = [];
  }, []);

  const startReel = useCallback(
    (durationMs: number, totalDistancePx: number, tileWidthPx: number) => {
      if (!enabledRef.current) return;
      stopAll();
      const tracker = createReelTracker(
        durationMs,
        totalDistancePx,
        tileWidthPx,
        fireTick
      );
      reelRef.current = tracker;
      tracker.start();
    },
    [stopAll]
  );

  const startDecel = useCallback(
    (durationMs: number) => {
      if (!enabledRef.current) return;
      stopAll();
      const delays = buildDecelSchedule(durationMs, 45);
      let acc = 0;
      for (const d of delays) {
        const id = setTimeout(fireTick, acc);
        decelTimers.current.push(id);
        acc += d;
      }
    },
    [stopAll]
  );

  const testFn = useCallback(() => {
    fireTick();
  }, []);

  // Stop on disable
  useEffect(() => {
    if (!soundEnabled) stopAll();
  }, [soundEnabled, stopAll]);

  // Stop on unmount
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  return { startReel, startDecel, stop: stopAll, test: testFn };
}
