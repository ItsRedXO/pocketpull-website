import React, { useState, useEffect } from 'react';
import { PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

interface StripePaymentFormProps {
  amountUsd: number;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onError: (msg: string) => void;
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  amountUsd, onSuccess, onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState('');

  // Clear error when amount changes
  useEffect(() => { setLocalError(''); }, [amountUsd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || processing) return;
    setProcessing(true);
    setLocalError('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/wallet?payment=return`,
        },
      });

      if (error) {
        const msg = error.message || 'Payment failed. Please try again.';
        setLocalError(msg);
        onError(msg);
      } else if (paymentIntent?.status === 'succeeded') {
        await onSuccess(paymentIntent.id);
      } else {
        const msg = `Payment ${paymentIntent?.status || 'incomplete'}. Please try again.`;
        setLocalError(msg);
        onError(msg);
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred.';
      setLocalError(msg);
      onError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-4">
      {/* Apple Pay / Google Pay Express Component */}
      <div className="mb-4">
        <ExpressCheckoutElement
          onConfirm={async (event) => {
            const { error } = await stripe!.confirmPayment({
              elements,
              confirmParams: {
                return_url: `${window.location.origin}/wallet?payment=return`,
              },
              redirect: 'if_required',
            });

            if (error) {
              const msg = error.message || 'Payment failed. Please try again.';
              setLocalError(msg);
              onError(msg);
            }
          }}
          options={{
            buttonType: {
              applePay: 'buy',
              googlePay: 'buy',
            },
            layout: {
              maxColumns: 1,
              maxRows: 1,
            }
          }}
        />
      </div>

      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-white/5" />
        <span className="text-[10px] text-gray-700 uppercase tracking-widest font-bold">Or pay with card</span>
        <div className="h-px flex-1 bg-white/5" />
      </div>

      {/* Stripe Payment Element — renders secure card fields */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: 'never',
              spacedAccordionItems: true
            },
            fields: {
              billingDetails: { address: { country: 'auto' } },
            },
            terms: { card: 'never' },
          }}
        />
      </div>

      {/* Local error */}
      {localError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertCircle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{localError}</p>
        </motion.div>
      )}

      {/* Submit button */}
      <motion.button
        type="submit"
        disabled={!stripe || !ready || processing}
        whileHover={(!processing && ready) ? { scale: 1.02, y: -1 } : {}}
        whileTap={(!processing && ready) ? { scale: 0.97 } : {}}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-display text-base uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shimmer-btn"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          boxShadow: '0 0 28px -6px rgba(16,185,129,0.65)',
          color: '#fff',
        }}
      >
        {processing ? (
          <><Loader2 size={16} className="animate-spin" />Processing…</>
        ) : !ready ? (
          <><Loader2 size={16} className="animate-spin" />Loading…</>
        ) : (
          <><Lock size={15} />Pay ${amountUsd.toFixed(2)} Securely</>
        )}
      </motion.button>

      {/* Powered by Stripe badge */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5">
        <Lock size={10} className="text-gray-600" />
        <span className="text-[10px] text-gray-600">Secured by Stripe · PCI DSS compliant</span>
      </div>
    </form>
  );
};