import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'Loading Your Collection...',
  'Preparing Your Pulls...',
  'Entering the Vault...',
  'Initializing Pack System...',
  'Shuffling the Deck...',
  'Counting Your Cards...',
  'Powering Up...',
  'Almost There...',
];

interface LoadingSplashProps {
  ready?: boolean;
}

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ ready = true }) => {
  const [visible, setVisible]     = useState(true);
  const [progress, setProgress]   = useState(0);
  const [msgIndex, setMsgIndex]   = useState(0);
  const rafRef = useRef<number | null>(null);
  const MIN_BRANDED_DURATION = 800;
  const MAX_WAIT_DURATION    = 15000;
  const PROGRESS_CAP         = 92;

  useEffect(() => {
    const animate = () => {
      setProgress(prev => {
        if (prev >= PROGRESS_CAP) return prev;
        const remaining = PROGRESS_CAP - prev;
        return Math.min(PROGRESS_CAP, prev + Math.max(0.15, remaining * 0.04));
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setMsgIndex(i => (i + 1) % MESSAGES.length), 1200);
    return () => clearInterval(id);
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
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          style={{
            backgroundImage: "url('/loading-bg.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Logo */}
          <motion.img
            src="/pocketpull-logo.png"
            alt="PocketPull"
            initial={{ opacity: 0, scale: 0.75, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '180px',
              height: '180px',
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.55))',
              marginBottom: '28px',
            }}
          />

          {/* Bar group */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              width: '360px',
              maxWidth: '82vw',
            }}
          >
            {/* Cycling message */}
            <AnimatePresence mode="wait">
              <motion.p
                key={msgIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="font-display text-white text-center uppercase"
                style={{
                  fontSize: '0.68rem',
                  letterSpacing: '0.06em',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(155,92,255,0.4)',
                }}
              >
                {MESSAGES[msgIndex]}
              </motion.p>
            </AnimatePresence>

            {/* Bar track */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '20px',
                background: 'rgba(4, 6, 16, 0.82)',
                border: '2px solid rgba(255,255,255,0.45)',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.72), inset 0 2px 6px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              {/* Fill */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #7c3aed 0%, #c084fc 100%)',
                  boxShadow: '0 0 14px rgba(192,132,252,0.7)',
                  transition: 'width 0.12s linear',
                }}
              />
              {/* Highlight stripe */}
              <div
                style={{
                  position: 'absolute',
                  top: '3px', left: 0, height: '4px',
                  width: `${progress}%`,
                  background: 'rgba(255,255,255,0.25)',
                  transition: 'width 0.12s linear',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Percentage */}
            <p
              className="font-display text-white tabular-nums"
              style={{ fontSize: '0.68rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
            >
              {Math.round(progress)}%
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
