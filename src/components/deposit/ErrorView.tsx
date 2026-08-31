import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ message, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-5 py-10 text-center"
    >
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}>
        <AlertCircle size={32} className="text-red-400" />
      </div>
      <div>
        <p className="font-display text-2xl text-white mb-1">Payment Failed</p>
        <p className="text-gray-500 text-sm max-w-xs">{message}</p>
      </div>
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        onClick={onRetry}
        className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
        Try Again
      </motion.button>
    </motion.div>
  );
};
