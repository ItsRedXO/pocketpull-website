import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  countdown: number;
  color: string;
  isVisible: boolean;
}

export const BattleCountdown: React.FC<Props> = ({ countdown, color, isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
        >
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="font-display text-[160px] leading-none"
            style={{ color: color, textShadow: `0 0 80px ${color}` }}
          >
            {countdown}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
