import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LOADING_STEPS = [
  'Loading Your Collection...',
  'Preparing Your Pulls...',
  'Entering the Vault...',
  'Initializing Pack System...',
];

interface LoadingSplashProps {
  ready?: boolean;
}

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ ready = true }) => {
  const [visible, setVisible]     = useState(true);
  const [progress, setProgress]   = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const rafRef = useRef<number | null>(null);
  const MIN_BRANDED_DURATION = 650;
  const MAX_WAIT_DURATION    = 15000;
  const PROGRESS_CAP         = 92;

  useEffect(() => {
    const animate = () => {
      setProgress(prev => {
        if (prev >= PROGRESS_CAP) return prev;
        const remaining  = PROGRESS_CAP - prev;
        const increment  = Math.max(0.15, remaining * 0.04);
        return Math.min(PROGRESS_CAP, prev + increment);
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => (i + 1) % LOADING_STEPS.length);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

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
    return () => { dismissed = true; window.clearTimeout(fallback); };
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage: "url('/hero-bg.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 60%',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Subtle dark overlay so content stays readable */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(4, 8, 16, 0.18)' }}
          />

          {/* ── Center content ── */}
          <div className="relative z-10 flex flex-col items-center" style={{ gap: '28px' }}>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center"
            >
              {/* Logo circle */}
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <img
                  src="/pocketpull-logo.png"
                  alt="PocketPull"
                  className="w-full h-full object-cover"
                  style={{ display: 'block', borderRadius: '50%' }}
                />
              </div>
            </motion.div>

            {/* Loading text + bar */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="flex flex-col items-center"
              style={{ gap: '14px', width: '560px', maxWidth: '90vw' }}
            >
              {/* Cycling loading message */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={stepIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="font-display text-white text-center uppercase"
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '0.05em',
                    textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(155,92,255,0.5)',
                  }}
                >
                  {LOADING_STEPS[stepIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Progress bar track */}
              <div
                className="relative w-full rounded-full overflow-hidden"
                style={{
                  height: '20px',
                  background: 'rgba(10, 12, 28, 0.75)',
                  border: '1.5px solid rgba(155,92,255,0.4)',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
                }}
              >
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)',
                    boxShadow: '0 0 12px rgba(168,85,247,0.8), 0 0 24px rgba(124,58,237,0.5)',
                    transition: 'width 0.1s linear',
                  }}
                />
                {/* Traveling shimmer */}
                <div
                  className="absolute inset-y-0 rounded-full pointer-events-none"
                  style={{
                    width: '60px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    left: `${Math.max(0, progress - 10)}%`,
                    transition: 'left 0.1s linear',
                  }}
                />
              </div>

              {/* Percentage */}
              <p
                className="font-display text-white tabular-nums"
                style={{
                  fontSize: '0.7rem',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                }}
              >
                {Math.round(progress)}%
              </p>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
