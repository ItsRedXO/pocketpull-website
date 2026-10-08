import React from 'react';
import { motion } from 'framer-motion';
import { useGuestTrial } from '../context/GuestTrialContext';

export const GuestTrialBanner: React.FC = () => {
  const { isGuest, actionsLeft, endGuestTrial } = useGuestTrial();

  if (!isGuest) return null;

  const handleSignUp = () => {
    endGuestTrial();
    window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' }));
  };

  const pips = Array.from({ length: 10 });

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-14 left-0 right-0 z-[49] flex items-center justify-between gap-3 px-4 py-2"
      style={{ background: 'rgba(9,9,15,0.97)', borderBottom: '1px solid rgba(155,92,255,0.25)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Guest Trial</span>
        <div className="flex items-center gap-1">
          {pips.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{ background: i < actionsLeft ? '#9b5cff' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
        <span className="text-[10px] text-white/30 shrink-0">{actionsLeft} action{actionsLeft !== 1 ? 's' : ''} left</span>
      </div>
      <button
        onClick={handleSignUp}
        className="shrink-0 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:brightness-110"
        style={{ background: 'linear-gradient(90deg, #9b5cff, #00c8ff)', color: '#000' }}
      >
        Sign Up Free
      </button>
    </motion.div>
  );
};
