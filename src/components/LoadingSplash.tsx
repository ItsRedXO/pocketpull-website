import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ── Floating particle ─────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  drift: number;
}

function useParticles(count: number): Particle[] {
  const [particles] = useState<Particle[]>(() => {
    const colors = ['#7c3aed', '#3b82f6', '#00c8ff', '#9b5cff', '#60a5fa'];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 4,
      drift: (Math.random() - 0.5) * 40,
    }));
  });
  return particles;
}

// ── Card silhouette data ───────────────────────────────────────────────────────
const CARD_SILHOUETTES = [
  { x: '8%',  y: '15%', rotate: -14, delay: 0.3,  scale: 0.7,  opacity: 0.12 },
  { x: '78%', y: '8%',  rotate: 11,  delay: 0.55, scale: 0.85, opacity: 0.1  },
  { x: '3%',  y: '58%', rotate: -7,  delay: 0.8,  scale: 0.65, opacity: 0.09 },
  { x: '82%', y: '55%', rotate: 15,  delay: 0.4,  scale: 0.75, opacity: 0.11 },
  { x: '88%', y: '78%', rotate: -9,  delay: 1.0,  scale: 0.6,  opacity: 0.08 },
  { x: '6%',  y: '80%', rotate: 6,   delay: 0.65, scale: 0.8,  opacity: 0.1  },
];

// ── Loading steps text ────────────────────────────────────────────────────────
const LOADING_STEPS = [
  'Initializing Pack System...',
  'Loading Card Database...',
  'Preparing Your Pulls...',
  'Entering the Vault...',
];

// ── Main component ────────────────────────────────────────────────────────────
interface LoadingSplashProps {
  /** Critical shell readiness, not account/profile readiness. */
  ready?: boolean;
}

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ ready = true }) => {
  const [visible, setVisible]       = useState(true);
  const [progress, setProgress]     = useState(0);
  const [stepIndex, setStepIndex]   = useState(0);
  const [logoReady, setLogoReady]   = useState(false);
  const particles = useParticles(28);
  const sweepControls = useAnimation();
  const rafRef = useRef<number | null>(null);
  const MIN_BRANDED_DURATION = 650;
  const MAX_WAIT_DURATION = 15000;

  // Keep the branded progress animation lightweight, but cap it and let readiness
  // decide when the shell can be dismissed.
  useEffect(() => {
    const startedAt = performance.now();
    const animate = (ts: number) => {
      const elapsed = ts - startedAt;
      const raw = Math.min(elapsed / MAX_WAIT_DURATION, 1);
      setProgress(Math.min(raw * 100, 99));
      if (raw < 1 && visible) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => (i + 1) % LOADING_STEPS.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  // Logo sweep shimmer loop
  useEffect(() => {
    const loop = async () => {
      await sweepControls.start({
        x: ['−100%', '150%'],
        transition: { duration: 1.6, ease: 'easeInOut' },
      });
      setTimeout(loop, 2800);
    };
    const t = setTimeout(loop, 800);
    return () => clearTimeout(t);
  }, [sweepControls]);

  // Dismiss once the critical shell is ready, with a short branded minimum and
  // a hard fallback so a slow auth/network request can never trap the site.
  useEffect(() => {
    const mountedAt = performance.now();
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      setProgress(100);
      setTimeout(() => setVisible(false), 220);
    };

    const maybeDismiss = () => {
      const remaining = Math.max(0, MIN_BRANDED_DURATION - (performance.now() - mountedAt));
      window.setTimeout(dismiss, remaining);
    };

    if (ready) maybeDismiss();
    const fallback = window.setTimeout(dismiss, MAX_WAIT_DURATION);
    return () => {
      dismissed = true;
      window.clearTimeout(fallback);
    };
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{ background: '#07080e' }}
        >

          {/* ── Layered background atmosphere ── */}
          {/* Deep radial glow 1 — purple left */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: 'radial-gradient(ellipse 70% 55% at 20% 40%, rgba(124,58,237,0.18) 0%, transparent 65%)',
          }} />
          {/* Deep radial glow 2 — blue right */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: 'radial-gradient(ellipse 65% 50% at 80% 55%, rgba(0,200,255,0.12) 0%, transparent 60%)',
          }} />
          {/* Center concentrated glow */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: 'radial-gradient(ellipse 40% 35% at 50% 48%, rgba(155,92,255,0.14) 0%, transparent 60%)',
          }} />

          {/* ── Faint grid texture ── */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.028]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(0,200,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.5) 1px, transparent 1px)',
              backgroundSize: '52px 52px',
            }}
          />

          {/* ── Animated ambient light sweep ── */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{ opacity: [0.0, 0.06, 0.0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{
              background: 'linear-gradient(135deg, transparent 20%, rgba(124,58,237,0.3) 50%, transparent 80%)',
            }}
          />

          {/* ── Floating particles ── */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              }}
              animate={{
                y: [0, -30 - Math.abs(p.drift), 0],
                x: [0, p.drift, 0],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          {/* ── Card silhouettes in background ── */}
          {CARD_SILHOUETTES.map((c, i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute"
              style={{ left: c.x, top: c.y }}
              initial={{ opacity: 0, scale: c.scale * 0.8 }}
              animate={{ opacity: c.opacity, scale: c.scale, y: [0, -8, 0] }}
              transition={{
                opacity: { delay: c.delay, duration: 1.2 },
                scale: { delay: c.delay, duration: 1.0 },
                y: { delay: c.delay + 0.5, duration: 5 + i * 0.4, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              {/* Card silhouette shape */}
              <div
                style={{
                  width: '62px',
                  height: '88px',
                  borderRadius: '6px',
                  border: '1px solid rgba(155,92,255,0.25)',
                  background: 'linear-gradient(160deg, rgba(124,58,237,0.08) 0%, rgba(0,200,255,0.04) 100%)',
                  transform: `rotate(${c.rotate}deg)`,
                  backdropFilter: 'blur(2px)',
                }}
              />
            </motion.div>
          ))}

          {/* ── Center content ── */}
          <div className="relative z-10 flex flex-col items-center" style={{ gap: '32px' }}>

            {/* Logo container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.75, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              onAnimationComplete={() => setLogoReady(true)}
              className="relative flex items-center justify-center"
            >
              {/* Outer glow ring — pulses */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.08, 0.25] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: '140px', height: '140px',
                  background: 'radial-gradient(ellipse, rgba(124,58,237,0.55) 0%, rgba(0,200,255,0.2) 50%, transparent 70%)',
                  filter: 'blur(12px)',
                }}
              />
              {/* Inner glow ring — counter-pulse */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
                style={{
                  width: '100px', height: '100px',
                  background: 'radial-gradient(ellipse, rgba(0,200,255,0.4) 0%, transparent 70%)',
                  filter: 'blur(8px)',
                }}
              />

              {/* Logo image with shimmer sweep */}
              <div
                className="relative overflow-hidden rounded-2xl"
                style={{
                  width: '88px', height: '88px',
                  boxShadow: '0 0 32px -4px rgba(124,58,237,0.7), 0 0 64px -16px rgba(0,200,255,0.4), 0 8px 32px rgba(0,0,0,0.6)',
                }}
              >
                <img
                  src="/pocketpull-logo.png"
                  alt="PocketPull"
                  className="w-full h-full object-cover"
                />
                {/* Shimmer sweep over logo */}
                {logoReady && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)',
                      transform: 'translateX(-100%)',
                    }}
                    animate={{ transform: ['translateX(-100%)', 'translateX(200%)'] }}
                    transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                  />
                )}
              </div>
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <h1
                className="font-display tracking-[0.22em] uppercase text-transparent bg-clip-text"
                style={{
                  fontSize: '1.65rem',
                  backgroundImage: 'linear-gradient(90deg, #00c8ff 0%, #9b5cff 50%, #00c8ff 100%)',
                  backgroundSize: '200% 100%',
                  filter: 'drop-shadow(0 0 18px rgba(0,200,255,0.5)) drop-shadow(0 0 36px rgba(155,92,255,0.3))',
                }}
              >
                PocketPull
              </h1>
              <div
                className="h-px w-24 rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.6), rgba(155,92,255,0.6), transparent)' }}
              />
            </motion.div>

            {/* Progress section */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
              className="flex flex-col items-center gap-3"
              style={{ width: '260px' }}
            >
              {/* Loading text — cycling */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={stepIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-[11px] uppercase tracking-[0.26em] text-center"
                  style={{ color: 'rgba(0,200,255,0.7)' }}
                >
                  {LOADING_STEPS[stepIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Progress bar track */}
              <div
                className="relative w-full rounded-full overflow-hidden"
                style={{
                  height: '3px',
                  background: 'rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                }}
              >
                {/* Fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #00c8ff)',
                    boxShadow: '0 0 8px rgba(0,200,255,0.8), 0 0 16px rgba(124,58,237,0.5)',
                    transition: 'width 0.1s linear',
                  }}
                />
                {/* Traveling shimmer on bar */}
                <motion.div
                  className="absolute inset-y-0 rounded-full pointer-events-none"
                  style={{
                    width: '40px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    left: `${Math.max(0, progress - 8)}%`,
                    transition: 'left 0.1s linear',
                  }}
                />
              </div>

              {/* Percentage */}
              <p
                className="font-display text-[10px] tracking-widest tabular-nums"
                style={{ color: 'rgba(155,92,255,0.6)' }}
              >
                {Math.round(progress)}%
              </p>
            </motion.div>

            {/* Bottom tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              transition={{ delay: 1.1, duration: 1.0 }}
              className="text-[9px] uppercase tracking-[0.35em] text-center"
              style={{ color: 'rgba(255,255,255,0.45)', marginTop: '-8px' }}
            >
              Premium Pokémon Pack Experience
            </motion.p>
          </div>

          {/* ── Bottom edge glow line ── */}
          <motion.div
            className="pointer-events-none absolute bottom-0 left-0 right-0"
            style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.5) 30%, rgba(0,200,255,0.5) 70%, transparent 100%)' }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
