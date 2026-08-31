import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface InventoryHeaderProps {
  totalCards: number;
  totalValue: number;
  lockedCount: number;
  sellableCount: number;
  sellableValue: number;
  sellAllConfirm: boolean;
  sellingAll: boolean;
  sellMsg: string | null;
  onSetSellAllConfirm: (val: boolean) => void;
  onHandleSellAll: () => void;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  totalCards,
  totalValue,
  lockedCount,
  sellableCount,
  sellableValue,
  sellAllConfirm,
  sellingAll,
  sellMsg,
  onSetSellAllConfirm,
  onHandleSellAll,
}) => {
  return (
    <>
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-display uppercase" style={{ background: 'linear-gradient(135deg, #00c8ff, #9b5cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            My Collection
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {totalCards} cards · Est. value:{' '}
            <span className="text-[#fbbf24] font-display font-bold">${totalValue.toFixed(2)}</span>
            {lockedCount > 0 && (
              <span className="ml-2 text-[#f59e0b] text-[11px]">
                🔒 {lockedCount} locked
              </span>
            )}
          </p>
        </div>

        {/* Sell All button */}
        {sellableCount > 0 && (
          <div>
            {sellAllConfirm ? (
              // Show processing OR confirm prompt — stays visible during API call
              sellingAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-[#fbbf24] border-t-transparent rounded-full animate-spin" />
                    Selling {sellableCount} cards…
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">
                    Sell {sellableCount} unlocked cards for{' '}
                    <span className="text-[#fbbf24] font-bold">${sellableValue.toFixed(2)}</span>?
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onHandleSellAll}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40"
                    style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    Confirm
                  </motion.button>
                  <button
                    onClick={() => onSetSellAllConfirm(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 text-gray-400 border border-white/10 transition-all hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSetSellAllConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase transition-all"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}
                title={`Sell all ${sellableCount} unlocked cards`}
              >
                <Trash2 size={14} />
                Sell All
                <span className="text-[10px] opacity-70">({sellableCount})</span>
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Sell message toast */}
      <AnimatePresence>
        {sellMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded-xl text-green-400 text-sm font-bold flex items-center gap-2"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            💰 {sellMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
