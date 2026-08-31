import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface SuccessViewProps {
  newBalance: number;
  paidAmount: number;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ newBalance, paidAmount }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center gap-5 py-10 text-center"
    >
      <div className="relative">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ 
            background: 'rgba(16,185,129,0.15)', 
            border: '2px solid rgba(16,185,129,0.45)', 
            boxShadow: '0 0 40px -8px rgba(16,185,129,0.7)' 
          }}
        >
          <CheckCircle2 size={32} className="text-[#10b981]" />
        </motion.div>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            className="absolute inset-0 rounded-full border border-[#10b981]"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.2 + i * 0.4, opacity: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div>
        <p className="font-display text-2xl text-white mb-1">Payment Successful!</p>
        <p className="text-gray-500 text-sm">
          <span className="text-[#10b981] font-bold">${paidAmount.toFixed(2)}</span> added to your balance
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="px-8 py-4 rounded-2xl"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
      >
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">New Balance</p>
        <p className="font-display text-3xl text-[#10b981]"
          style={{ textShadow: '0 0 24px rgba(16,185,129,0.6)' }}>
          ${newBalance.toFixed(2)}
        </p>
      </motion.div>
    </motion.div>
  );
};
