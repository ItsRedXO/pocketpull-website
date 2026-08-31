import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet } from 'lucide-react';
import { blink } from '../lib/blink';
import { createPaymentIntent } from '../lib/stripe';

// Modules
import {
  DepositModalProps,
  CardFlowState,
} from './deposit/DepositConstants';
import { SuccessView } from './deposit/SuccessView';
import { ErrorView } from './deposit/ErrorView';
import { CardAmountSelection } from './deposit/CardAmountSelection';
import { StripePaymentSection } from './deposit/StripePaymentSection';

const BACKEND = 'https://b2nnhe2n.backend.blink.new';

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen, onClose, userId, username, email, currentBalance, onBalanceUpdate,
}) => {
  // ── Card / Stripe state ──────────────────────────────────────
  const [amount, setAmount]               = useState(25);
  const [custom, setCustom]               = useState('');
  const [cardFlow, setCardFlow]           = useState<CardFlowState>('amount');
  const [clientSecret, setClientSecret]   = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [intentError, setIntentError]     = useState('');
  const [newBal, setNewBal]               = useState(0);
  const [paidAmount, setPaidAmount]       = useState(0);
  const [hasDeposited, setHasDeposited]   = useState<boolean | null>(null);

  const effectiveAmt = custom ? parseFloat(custom) || 0 : amount;

  // ── Reset & close ────────────────────────────────────────────
  const reset = useCallback(() => {
    setAmount(25); setCustom('');
    setCardFlow('amount'); setClientSecret(null);
    setCreatingIntent(false); setIntentError('');
    setNewBal(0); setPaidAmount(0);
  }, []);

  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  // Stop polling when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      document.body.style.overflow = 'unset';
    } else {
      document.body.style.overflow = 'hidden';
      // Check if user has ever deposited (for first-deposit promo)
      if (userId) {
        blink.db.transactions.count({ where: { userId, type: 'deposit' } })
          .then(count => setHasDeposited(count > 0))
          .catch(() => setHasDeposited(true)); // safety: hide promo on error
      }
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, reset, userId]);

  // ── Card: Step 1 — Create PaymentIntent ─────────────────────
  const proceedToPayment = async () => {
    setIntentError('');
    try {
      const userRow = await blink.db.users.get(userId);
      if (userRow && Number((userRow as any).isBanned) > 0) {
        setIntentError('Your account is currently banned. Please contact support.');
        return;
      }
    } catch (e) { console.error('Ban check failed', e); }

    if (effectiveAmt < 5) { setIntentError('Minimum deposit is $5.00'); return; }
    setCreatingIntent(true);
    try {
      const secret = await createPaymentIntent(effectiveAmt, userId, username, email);
      setClientSecret(secret);
      setCardFlow('payment');
    } catch (err: any) {
      setIntentError(err?.message || 'Failed to initialize payment. Please try again.');
    } finally {
      setCreatingIntent(false);
    }
  };

  // ── Card: Step 2 — After Stripe confirmation ─────────────────
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      console.log(`[DepositModal] Verifying Stripe deposit: ${paymentIntentId}`);
      
      const response = await fetch(`${BACKEND}/verify-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      });
      
      const result = await response.json() as any;
      
      if (!response.ok || result.error) {
        console.error('[DepositModal] Verify deposit failed:', result.error);
        setIntentError(result.error || 'Balance update failed. Please contact support.');
        setCardFlow('error');
        return;
      }

      console.log('[DepositModal] Deposit verified successfully');
      const { newBalance } = result;
      setPaidAmount(effectiveAmt);
      setNewBal(newBalance || currentBalance + effectiveAmt);
      
      if (newBalance !== undefined) {
        onBalanceUpdate(newBalance);
      } else {
        // Fallback if backend didn't return balance for some reason
        onBalanceUpdate(currentBalance + effectiveAmt);
      }
      
      setCardFlow('success');
      setHasDeposited(true); // hide first-deposit promo immediately
      setTimeout(close, 4500);
    } catch (err: any) {
      console.error('[DepositModal] Payment success handling error:', err);
      setIntentError('Balance update is taking longer than expected. Please refresh in a moment.');
      setCardFlow('error');
    }
  };

  const handlePaymentError = (msg: string) => setIntentError(msg);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="deposit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,5,10,0.92)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && close()}
        >
          <motion.div
            key="deposit-panel"
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh] flex flex-col"
            style={{
              background: 'linear-gradient(160deg, #0d0f1a 0%, #0a0c14 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow:
                '0 0 0 1px rgba(0,200,255,0.08), 0 0 60px -12px rgba(0,200,255,0.18), 0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), rgba(155,92,255,0.4), transparent)' }} />

            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Wallet size={17} className="text-[#10b981]" />
                </div>
                <div>
                  <h2 className="font-display text-[22px] text-white tracking-wide leading-tight">Add Funds</h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    {cardFlow === 'payment'
                      ? `Paying $${effectiveAmt.toFixed(2)} securely via Stripe`
                      : 'Choose a payment method and deposit amount.'}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/8 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Balance chip */}
            <div className="mx-7 mb-5 flex items-center justify-between px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs text-gray-500">Current Balance</span>
              <span className="font-display text-base text-[#10b981]">${currentBalance.toFixed(2)}</span>
            </div>

            {/* Content */}
            <div className="px-7 pb-7">
              <AnimatePresence mode="wait">
                <motion.div key={`card-${cardFlow}`}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>

                    {cardFlow === 'success' && (
                      <SuccessView newBalance={newBal} paidAmount={paidAmount} />
                    )}

                    {cardFlow === 'error' && (
                      <ErrorView
                        message={intentError || 'Something went wrong. Please contact support.'}
                        onRetry={() => { setCardFlow('amount'); setClientSecret(null); setIntentError(''); }}
                      />
                    )}

                    {cardFlow === 'amount' && (
                      <CardAmountSelection
                        amount={amount}
                        custom={custom}
                        setAmount={setAmount}
                        setCustom={setCustom}
                        intentError={intentError}
                        setIntentError={setIntentError}
                        creatingIntent={creatingIntent}
                        proceedToPayment={proceedToPayment}
                        effectiveAmt={effectiveAmt}
                        hasDeposited={hasDeposited}
                      />
                    )}

                    {cardFlow === 'payment' && clientSecret && (
                      <StripePaymentSection
                        effectiveAmt={effectiveAmt}
                        clientSecret={clientSecret}
                        intentError={intentError}
                        onBack={() => { setCardFlow('amount'); setClientSecret(null); setIntentError(''); }}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                      />
                    )}
                  </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
