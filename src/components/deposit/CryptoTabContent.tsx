import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, RotateCcw, Bitcoin } from 'lucide-react';
import { CRYPTO_OPTIONS, PRESET_AMOUNTS, CryptoOption, CryptoOptionData, CryptoFlowState } from './DepositConstants';
import { Label } from './DepositHelpers';

interface CryptoTabContentProps {
  crypto: CryptoOption;
  setCrypto: (opt: CryptoOption) => void;
  cryptoAmt: number;
  setCryptoAmt: (amt: number) => void;
  cryptoData: CryptoOptionData;
  cryptoFlow: CryptoFlowState;
  creating: boolean;
  chargeId: string | null;
  cryptoError: string;
  newBalance: number;
  paidAmount: number;
  onCheckout: () => void;
  onReset: () => void;
}

export const CryptoTabContent: React.FC<CryptoTabContentProps> = ({
  crypto,
  setCrypto,
  cryptoAmt,
  setCryptoAmt,
  cryptoData,
  cryptoFlow,
  creating,
  chargeId,
  cryptoError,
  newBalance,
  paidAmount,
  onCheckout,
  onReset,
}) => {

  /* ── Success state ───────────────────────────────────────────── */
  if (cryptoFlow === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
          <CheckCircle2 size={32} className="text-[#10b981]" />
        </div>
        <div>
          <p className="font-display text-2xl text-white">${paidAmount.toFixed(2)} Received!</p>
          <p className="text-sm text-gray-400 mt-1">Coinbase payment confirmed.</p>
        </div>
        <div className="px-5 py-3 rounded-xl text-center"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs text-gray-500">New Balance</p>
          <p className="font-display text-xl text-[#10b981]">${newBalance.toFixed(2)}</p>
        </div>
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────────────── */
  if (cryptoFlow === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <p className="text-sm text-red-400 leading-relaxed max-w-xs">{cryptoError || 'Something went wrong.'}</p>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
          <RotateCcw size={14} /> Try Again
        </motion.button>
      </div>
    );
  }

  /* ── Pending state ───────────────────────────────────────────── */
  if (cryptoFlow === 'pending') {
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        {/* Spinner */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full animate-spin"
            style={{ border: '2px solid rgba(0,200,255,0.12)', borderTopColor: '#00c8ff' }} />
          <Bitcoin size={32} className="text-[#f7931a]" />
        </div>

        <div className="text-center space-y-1">
          <p className="font-display text-lg text-white">Waiting for Payment…</p>
          <p className="text-xs text-gray-500">Complete your payment in the Coinbase tab that opened.</p>
          <p className="text-xs text-gray-600">Balance updates automatically once confirmed.</p>
        </div>

        {chargeId && (
          <div className="w-full px-4 py-2.5 rounded-xl flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Charge ID</span>
            <span className="font-mono text-[11px] text-gray-400">{chargeId.slice(0, 8)}…</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <Loader2 size={13} className="text-gray-600 animate-spin" />
          <span className="text-xs text-gray-600">Polling for confirmation every 10s…</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="text-xs text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors mt-1">
          Cancel and start over
        </motion.button>
      </div>
    );
  }

  /* ── Amount selection + checkout button ──────────────────────── */
  return (
    <div className="space-y-5">
      {/* Coin selector */}
      <div>
        <Label>Select Coin</Label>
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          {CRYPTO_OPTIONS.map(opt => {
            const sel = crypto === opt.id;
            return (
              <motion.button key={opt.id}
                whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }}
                onClick={() => setCrypto(opt.id as CryptoOption)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all"
                style={{
                  background: sel ? `${opt.color}12` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${sel ? opt.color : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: sel ? `0 0 20px -6px ${opt.color}88` : 'none',
                }}>
                <span style={{ color: sel ? opt.color : '#6b7280' }}>{opt.icon}</span>
                <span className="font-bold text-xs tracking-wider"
                  style={{ color: sel ? '#fff' : '#9ca3af' }}>{opt.id}</span>
                <span className="text-[10px] text-gray-600">{opt.network}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Amount presets */}
      <div>
        <Label>Amount (USD)</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {PRESET_AMOUNTS.map(a => {
            const sel = cryptoAmt === a;
            return (
              <motion.button key={a}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setCryptoAmt(a)}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: sel ? `${cryptoData.color}12` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${sel ? cryptoData.color + '80' : 'rgba(255,255,255,0.08)'}`,
                  color: sel ? cryptoData.color : '#9ca3af',
                  boxShadow: sel ? `0 0 14px -5px ${cryptoData.color}66` : 'none',
                }}>
                ${a}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Checkout CTA */}
      <div className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${cryptoData.color}30`, background: `${cryptoData.color}07` }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${cryptoData.color}20` }}>
          <div className="flex items-center gap-2">
            <span style={{ color: cryptoData.color }}>{cryptoData.icon}</span>
            <span className="text-sm font-bold text-white">Pay with {cryptoData.name}</span>
          </div>
          <span className="font-display text-base" style={{ color: cryptoData.color }}>${cryptoAmt}</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
            You'll be redirected to <span className="text-white font-semibold">Coinbase Commerce</span>{' '}
            to complete your payment securely. Your balance is credited automatically once confirmed on-chain.
          </p>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={onCheckout}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
            style={{
              background: creating ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${cryptoData.color}cc, ${cryptoData.color}88)`,
              border: `1.5px solid ${cryptoData.color}66`,
              color: '#fff',
              boxShadow: creating ? 'none' : `0 4px 20px -6px ${cryptoData.color}88`,
            }}>
            {creating
              ? <><Loader2 size={15} className="animate-spin" /> Creating Checkout…</>
              : <><ExternalLink size={14} /> Pay ${cryptoAmt} with Coinbase</>}
          </motion.button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <AlertCircle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-yellow-400/80 leading-relaxed">
          Allow up to 15 minutes for network confirmation.
          Balance updates automatically once payment is verified.
        </p>
      </div>
    </div>
  );
};
