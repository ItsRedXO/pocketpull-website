import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoadingScreenConfig, DEFAULT_LOADING_CONFIG } from '../hooks/useSiteConfig';

interface LoadingSplashProps {
  ready?: boolean;
}

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ ready = true }) => {
  const { config } = useLoadingScreenConfig();
  const messages = config.messages.length ? config.messages : DEFAULT_LOADING_CONFIG.messages;

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
      setStepIndex(i => (i + 1) % messages.length);
    }, 1100);
    return () => clearInterval(interval);
  }, [messages.length]);

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
            backgroundImage: "url('/loading-bg.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
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
              <img
                src="/pocketpull-logo.png"
                alt="PocketPull"
                style={{ width: '200px', height: '200px', display: 'block', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}
              />
            </motion.div>

            {/* Loading text + bar */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="flex flex-col items-center"
              style={{ gap: '14px', width: '420px', maxWidth: '82vw' }}
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
                  {messages[stepIndex % messages.length]}
                </motion.p>
              </AnimatePresence>

              {/* Progress bar — pixel art style: dark opaque track, sharp fill */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  height: '22px',
                  background: 'rgba(4, 6, 16, 0.82)',
                  border: '2px solid rgba(255,255,255,0.45)',
                  /* dark outer ring = classic double-border pixel art frame */
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.72), 0 4px 24px rgba(0,0,0,0.4), inset 0 2px 6px rgba(0,0,0,0.5)',
                }}
              >
                {/* Fill */}
                <div
                  className="absolute inset-0"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${config.barColor1} 0%, ${config.barColor2} 100%)`,
                    boxShadow: `0 0 14px ${config.barColor2}cc`,
                    transition: 'width 0.12s linear',
                  }}
                />
                {/* Top highlight — 8-bit HP bar shine */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '3px',
                    left: 0,
                    height: '4px',
                    width: `${progress}%`,
                    background: 'rgba(255,255,255,0.26)',
                    transition: 'width 0.12s linear',
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
