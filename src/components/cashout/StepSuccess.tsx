import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

interface Props {
  confirmationNumber: string;
  email: string;
  onClose: () => void;
}

export const StepSuccess: React.FC<Props> = ({ confirmationNumber, email, onClose }) => (
  <motion.div
    key="step4"
    initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="flex flex-col items-center text-center py-8 space-y-5"
  >
    <motion.div
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 18 }}
    >
      <CheckCircle size={62} style={{ color: '#10b981' }} />
    </motion.div>

    <div>
      <h3 className="font-display text-2xl text-white tracking-wide mb-1">Request Submitted!</h3>
      <p className="text-sm text-gray-500">Your cashout request is now pending review.</p>
    </div>

    <div className="px-6 py-4 rounded-xl w-full"
      style={{ background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.25)' }}>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Confirmation Number</p>
      <p className="font-display text-2xl text-white tracking-widest">{confirmationNumber}</p>
    </div>

    <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
      Cards have been removed from your inventory and your cashout request is now pending. A confirmation email has been sent to{' '}
      <strong className="text-gray-400">{email}</strong>.
    </p>

    <motion.button
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClose}
      className="px-8 py-3 rounded-xl font-display text-base uppercase tracking-wide"
      style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 24px -6px rgba(16,185,129,0.55)', color: '#fff' }}
    >
      Done
    </motion.button>
  </motion.div>
);
