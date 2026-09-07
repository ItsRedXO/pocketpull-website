import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../lib/stripe';
import { StripePaymentForm } from '../StripePaymentForm';
import { STRIPE_APPEARANCE } from './DepositConstants';

interface StripePaymentSectionProps {
  effectiveAmt: number;
  clientSecret: string;
  intentError: string;
  onBack: () => void;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onError: (msg: string) => void;
}

export const StripePaymentSection: React.FC<StripePaymentSectionProps> = ({
  effectiveAmt,
  clientSecret,
  intentError,
  onBack,
  onSuccess,
  onError,
}) => {
  return (
    <div className="space-y-4">
      {/* Back button + amount summary */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
        >
          <RefreshCw size={11} /> Go Back
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}>
          <Plus size={10} className="text-[#00c8ff]" />
          <span className="text-[11px] font-bold text-[#00c8ff]">${effectiveAmt.toFixed(2)}</span>
        </div>
      </div>

      {/* Error from prior attempt */}
      <AnimatePresence>
        {intentError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{intentError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stripe Payment Element */}
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
      >
        <StripePaymentForm
          amountUsd={effectiveAmt}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
};
