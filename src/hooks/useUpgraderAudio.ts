/**
 * useUpgraderAudio — suspense sweep + win/lose stings for the upgrader.
 *
 * Uses the Web Audio API directly (not Howler) because the suspense
 * sound requires real-time filter/gain automation that maps to the
 * two-phase spinner animation (~4 s: fast linear → ease-out).
 *
 * ── Sound design ──
 *  Suspense: layered wind-rush texture
 *    • Layer A — white noise through a slowly-narrowing bandpass filter
 *      (1200Hz → 220Hz) that creates the sensation of focus tightening
 *      as the result approaches.
 *    • Layer B — low 180Hz triangle wave with an amplitude tremolo
 *      whose rate decays from ~8 Hz to ~2 Hz, syncing with the
 *      spinner's speed. Subtle, barely audible until phase 2.
 *    • Gain envelope: quick fade-in (200ms), sustain during phase 1,
 *      gentle fade-out during phase 2 (last 1.5s).
 *
 *  Win: bright ascending three-note chime
 *    • Sine wave: C5(16) → E5(16) → G5(24), each with soft attack
 *      and long tail. Total ~750ms. Feels rewarding without being
 *      flashy.
 *
 *  Loss: soft descending bend
 *    • Triangle wave bending from G4 down to C4 over ~600ms.
 *      Low volume, no sharp attack — signals failure without
 *      punishing the player.
 */

import { useCallback, useEffect, useRef } from 'react';

// ── Single shared AudioContext (lazy, per browser autoplay rules) ──

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Helper — Gaussian noise buffer (2s loop) ──

let _noiseBuf: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (_noiseBuf) return _noiseBuf;
  const len = ctx.sampleRate * 2; // 2 seconds
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}

// ── Win chime (synthesised WAV → Howl-like one-shot via Web Audio) ──

function playWinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, start: 0,    dur: 0.16 },  // C5
    { freq: 659.25, start: 0.14, dur: 0.16 },  // E5
    { freq: 783.99, start: 0.28, dur: 0.28 },  // G5
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, now + n.start);
    gain.gain.setValueAtTime(0, now + n.start);
    gain.gain.linearRampToValueAtTime(0.18, now + n.start + 0.03); // attack
    gain.gain.setValueAtTime(0.18, now + n.start + 0.05);
    gain.gain.linearRampToValueAtTime(0,   now + n.start + n.dur);  // release
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.dur + 0.01);
  }
}

// ── Loss tone (descending bend) ──

function playLossSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(392, now);            // G4
  osc.frequency.linearRampToValueAtTime(261.63, now + 0.6); // → C4
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
  gain.gain.setValueAtTime(0.12, now + 0.1);
  gain.gain.linearRampToValueAtTime(0, now + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.65);
}

// ── Suspense engine (returns a stop function) ──

function buildSuspense(ctx: AudioContext): () => void {
  const now = ctx.currentTime;
  const totalDur = 3.2;

  // ── Layer A — filtered noise sweep ──
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer(ctx);
  noiseSrc.loop = true;

  const bpFilter = ctx.createBiquadFilter();
  bpFilter.type = 'bandpass';
  bpFilter.frequency.setValueAtTime(1200, now);                    // phase 1
  bpFilter.frequency.linearRampToValueAtTime(1200, now + 1.5);
  bpFilter.frequency.linearRampToValueAtTime(220, now + totalDur); // phase 2 narrow down
  bpFilter.Q.setValueAtTime(0.7, now);
  bpFilter.Q.linearRampToValueAtTime(1.8, now + totalDur);        // focus tightens

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.2);
  noiseGain.gain.setValueAtTime(0.06, now + 2.0);
  noiseGain.gain.linearRampToValueAtTime(0, now + totalDur);

  noiseSrc.connect(bpFilter).connect(noiseGain).connect(ctx.destination);
  noiseSrc.start(now);

  // ── Layer B — low triangle with tremolo ──
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);

  const tremolo = ctx.createGain();
  tremolo.gain.setValueAtTime(0, now);
  // Tremolo rate: 8 Hz → 1.5 Hz over the duration
  // We approximate with scheduled ramps
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(8, now);
  lfo.frequency.linearRampToValueAtTime(8, now + 1.5);
  lfo.frequency.linearRampToValueAtTime(1.5, now + totalDur);

  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(0.5, now);   // 0→1 modulation around center

  lfo.connect(lfoDepth);
  // LFO modulates tremolo gain: center 0.4, depth 0.3 → oscillates 0.1↔0.7
  const tremoloCenter = ctx.createGain();
  tremoloCenter.gain.setValueAtTime(0.35, now);

  lfoDepth.connect(tremolo.gain);
  tremoloCenter.connect(tremolo.gain);

  const oscOutGain = ctx.createGain();
  oscOutGain.gain.setValueAtTime(0, now);
  oscOutGain.gain.linearRampToValueAtTime(0.03, now + 0.3);
  oscOutGain.gain.setValueAtTime(0.03, now + 2.0);
  oscOutGain.gain.linearRampToValueAtTime(0, now + totalDur);

  osc.connect(tremolo).connect(oscOutGain).connect(ctx.destination);
  osc.start(now);
  lfo.start(now);

  // ── Stop all nodes ──
  const nodes = [noiseSrc, osc, lfo];
  return () => {
    try {
      for (const n of nodes) {
        try { n.stop(); } catch { /* already stopped */ }
      }
    } catch { /* ignore */ }
  };
}

// ── Hook ──

export function useUpgraderAudio(enabled: boolean) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const startSuspense = useCallback(() => {
    if (!enabledRef.current) return;
    // Stop any previous suspense
    cleanupRef.current?.();
    try {
      const ctx = getCtx();
      cleanupRef.current = buildSuspense(ctx);
    } catch (err) {
      console.warn('[UPGRADER AUDIO] startSuspense error', err);
    }
  }, []);

  const stopSuspense = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const playWin = useCallback(() => {
    if (!enabledRef.current) return;
    try { playWinSound(getCtx()); } catch { /* ignore */ }
  }, []);

  const playLoss = useCallback(() => {
    if (!enabledRef.current) return;
    try { playLossSound(getCtx()); } catch { /* ignore */ }
  }, []);

  // Pause suspense if sound is disabled mid-spin
  useEffect(() => {
    if (!enabled && cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  return { startSuspense, stopSuspense, playWin, playLoss };
}
