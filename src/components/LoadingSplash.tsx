import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingSplashProps {
  ready?: boolean;
}

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ ready = true }) => {
  const [visible, setVisible] = useState(true);
  const MIN_BRANDED_DURATION = 800;
  const MAX_WAIT_DURATION    = 15000;

  useEffect(() => {
    const mountedAt = performance.now();
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
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
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage: "url('/loading-bg.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
          }}
        >
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
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
