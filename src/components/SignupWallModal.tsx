import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useGuestTrial } from '../context/GuestTrialContext';

interface Props {
  isOpen: boolean;
}

export const SignupWallModal: React.FC<Props> = ({ isOpen }) => {
  const { dismissSignupWall, endGuestTrial } = useGuestTrial();

  const handleSignUp = () => {
    endGuestTrial();
    dismissSignupWall();
    window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' }));
  };

  const handleMaybeLater = () => {
    dismissSignupWall();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 p-7 text-center flex flex-col items-center gap-5"
            style={{ background: 'linear-gradient(160deg, #0e1020 0%, #09090f 100%)' }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(155,92,255,0.15)', border: '2px solid rgba(155,92,255,0.3)', boxShadow: '0 0 30px rgba(155,92,255,0.2)' }}>
              <Trophy size={28} className="text-[#9b5cff]" />
            </div>

            <div>
              <h2 className="font-display text-2xl uppercase tracking-tight text-white mb-2">
                Trial Complete
              </h2>
              <p className="text-white/50 text-sm leading-relaxed">
                You've used all 10 free actions. Create a free account to keep playing — your trial progress won't be saved.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleSignUp}
                className="w-full py-3.5 rounded-xl font-display text-sm uppercase tracking-widest font-bold"
                style={{ background: 'linear-gradient(90deg, #9b5cff, #00c8ff)', color: '#000', boxShadow: '0 0 22px rgba(0,200,255,0.3)' }}
              >
                Create Free Account
              </motion.button>
              <button
                onClick={handleMaybeLater}
                className="w-full py-2.5 text-xs text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
