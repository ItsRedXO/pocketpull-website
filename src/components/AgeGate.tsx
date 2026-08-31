import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const AgeGate: React.FC = () => {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem('age-verified');
    if (!verified) {
      setShow(true);
    }
  }, []);

  const handleVerify = () => {
    if (!checked) return;
    localStorage.setItem('age-verified', 'true');
    setShow(false);
  };

  const handleExit = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'radial-gradient(ellipse at center, rgba(155,92,255,0.08) 0%, rgba(0,0,0,0.97) 100%)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="max-w-md w-full p-8 text-center space-y-6 relative"
            style={{
              background: 'rgba(13, 14, 20, 0.98)',
              border: '1px solid rgba(155,92,255,0.2)',
              borderRadius: '20px',
              boxShadow: '0 0 60px -10px rgba(155,92,255,0.25), 0 40px 80px rgba(0,0,0,0.9)',
            }}
          >
            {/* Glow top border */}
            <div className="absolute top-0 left-0 right-0 h-[1px] rounded-t-[20px]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), rgba(155,92,255,0.7), transparent)' }} />

            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <img src="/pocketpull-logo.png" alt="PocketPull" className="w-16 h-16 rounded-full object-cover" style={{ boxShadow: '0 0 30px rgba(155,92,255,0.4)' }} />
              <h1 className="text-3xl font-display bg-gradient-to-r from-[#00c8ff] to-[#9b5cff] bg-clip-text text-transparent">
                POCKETPULL
              </h1>
              <p className="text-gray-500 uppercase tracking-widest text-xs font-semibold">
                Premium Mystery Experience
              </p>
            </div>

            {/* Age badge */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.25)' }}>
                🔞
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display text-white">Age Verification Required</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                You must be 18 years or older to access PocketPull. By entering, you confirm you meet the age requirement and agree to our Terms of Service.
              </p>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer text-left p-3 rounded-xl transition-all hover:bg-white/5"
              style={{ border: `1px solid ${checked ? 'rgba(155,92,255,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-500 shrink-0"
              />
              <span className="text-sm text-gray-300">
                I confirm I am <span className="text-white font-bold">18 years of age or older</span> and agree to the Terms of Service and Responsible Gaming policy.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleVerify}
                disabled={!checked}
                className="flex-1 font-display py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
                style={{
                  background: checked ? 'linear-gradient(135deg, #9b5cff, #6b2cd9)' : 'rgba(155,92,255,0.15)',
                  color: checked ? '#fff' : 'rgba(255,255,255,0.3)',
                  boxShadow: checked ? '0 0 25px -5px rgba(155,92,255,0.6)' : 'none',
                  cursor: checked ? 'pointer' : 'not-allowed',
                  border: '1px solid rgba(155,92,255,0.2)',
                }}
              >
                ENTER SITE
              </button>
              <button
                onClick={handleExit}
                className="flex-1 font-display py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                EXIT
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
