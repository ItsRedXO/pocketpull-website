import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { type InventoryCard, type MarketCard, RARITY_COLORS } from './exchangerTypes';
import { ReceiveChips } from './ReceiveChips';

interface ExchangeSummaryProps {
  user: any;
  offerCards: InventoryCard[];
  receiveCards: Set<string>;
  marketCards: MarketCard[];
  offerTotal: number;
  receiveTotal: number;
  diff: number;
  exchanging: boolean;
  exchangeError: string;
  canExchange: boolean;
  handleExchange: () => void;
  toggleOffer: (card: InventoryCard) => void;
  setReceiveCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  maxOffer: number;
  maxReceive: number;
}

export const ExchangeSummary: React.FC<ExchangeSummaryProps> = ({
  user,
  offerCards,
  receiveCards,
  marketCards,
  offerTotal,
  receiveTotal,
  diff,
  exchanging,
  exchangeError,
  canExchange,
  handleExchange,
  toggleOffer,
  setReceiveCards,
  maxOffer,
  maxReceive
}) => {
  return (
    <div className="glass-card p-5 flex flex-col gap-4"
      style={{ borderColor: offerCards.length > 0 ? 'rgba(0,200,255,0.2)' : undefined }}>
      <h2 className="font-display text-base uppercase text-gray-200 text-center">Exchange Summary</h2>

      {/* Offer chips */}
      <div className="flex-1">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">You Offer</p>
        {offerCards.length === 0 ? (
          <p className="text-gray-700 text-xs italic text-center py-4">
            Select up to {maxOffer} cards →
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence>
              {offerCards.map(c => {
                const col = RARITY_COLORS[c.rarity] ?? '#888';
                return (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    className="flex items-center gap-4 px-3 py-3 rounded-2xl"
                    style={{ background: col + '15', border: `1.5px solid ${col}30` }}>
                    <div className="w-16 h-20 bg-black/40 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-lg">
                      {c.cardImageUrl ? (
                        <img src={c.cardImageUrl} alt={c.cardName} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-2xl">🎴</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-white truncate leading-tight mb-0.5">{c.cardName}</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: col }}>{c.rarity}</p>
                    </div>
                    <div className="text-right shrink-0 pr-1">
                      <p className="text-[15px] text-[#ffd700] font-display font-bold">${c.value.toFixed(2)}</p>
                    </div>
                    <button onClick={() => toggleOffer(c)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-400/15 transition-all shrink-0">
                      <X size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Arrow */}
      <div className="flex justify-center my-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: offerCards.length > 0 ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${offerCards.length > 0 ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}>
          <ArrowRightLeft size={14} style={{ color: offerCards.length > 0 ? '#00c8ff' : '#4b5563' }} />
        </div>
      </div>

      {/* You Receive */}
      <div className="flex-1">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">You Receive</p>
        {receiveCards.size === 0 ? (
          <p className="text-gray-700 text-xs italic text-center py-4">
            ← Select up to {maxReceive} cards
          </p>
        ) : (
          <ReceiveChips 
            marketCards={marketCards}
            receiveIds={receiveCards} 
            onRemove={id => setReceiveCards(prev => { const n = new Set(prev); n.delete(id); return n; })} 
          />
        )}
      </div>

      {/* Value breakdown */}
      <div className="border-t border-white/6 pt-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Offer value</span>
          <span className="font-bold text-white">${offerTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Receive value</span>
          <span className="font-bold text-white">${receiveTotal.toFixed(2)}</span>
        </div>
        {offerCards.length > 0 && receiveCards.size > 0 && (
          <div className="flex justify-between pt-1 border-t border-white/5">
            <span className="text-gray-500">Balance refund</span>
            <span className="font-bold" style={{ color: diff > 0 ? '#10b981' : '#6b7280' }}>
              {diff > 0 ? `+$${diff.toFixed(2)}` : '$0.00'}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {(exchangeError || diff < 0) && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-xs text-red-400 text-center font-bold">
            {exchangeError || 'Receive value cannot exceed trade-in value'}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Exchange button */}
      <motion.button
        onClick={handleExchange}
        disabled={!canExchange || exchanging}
        whileHover={canExchange ? { scale: 1.03 } : {}}
        whileTap={canExchange ? { scale: 0.97 } : {}}
        className="w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all shimmer-btn"
        style={{
          background: canExchange
            ? 'linear-gradient(135deg, #00c8ff, #0084aa)'
            : 'rgba(0,200,255,0.08)',
          color: canExchange ? '#000' : '#4b5563',
          boxShadow: canExchange ? '0 0 30px -5px rgba(0,200,255,0.5)' : 'none',
        }}
      >
        {exchanging ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
        {exchanging ? 'Exchanging...' : 'Exchange'}
      </motion.button>

      {!user && (
        <p className="text-center text-xs text-yellow-400">Sign in to exchange cards</p>
      )}
    </div>
  );
};
