import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Package, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';
import { InventoryItem } from './types';
import { rarityColor } from './shared';

interface Props {
  inventory: InventoryItem[];
  loadingInv: boolean;
  selected: InventoryItem[];
  onToggleCard: (item: InventoryItem) => void;
  selError: string;
  onContinue: () => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

const MAX_CARDS = 25;
const MIN_VALUE = 25;
const CARDS_PER_PAGE = 12;

export const StepSelectCards: React.FC<Props> = ({
  inventory, 
  loadingInv, 
  selected, 
  onToggleCard, 
  selError, 
  onContinue,
  currentPage,
  setCurrentPage
}) => {
  const totalValue = selected.reduce((s, c) => s + c.value, 0);
  const selectedIds = new Set(selected.map(s => s.id));
  const canContinue = totalValue >= MIN_VALUE;

  return (
    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      {/* Notice banner */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-4"
        style={{ background: 'rgba(155,92,255,0.07)', border: '1px solid rgba(155,92,255,0.18)' }}>
        <AlertCircle size={13} style={{ color: '#9b5cff', flexShrink: 0 }} />
        <p className="text-[12px]" style={{ color: '#c4b0ff' }}>Minimum cashout is <strong>$25</strong>. Maximum <strong>25 cards</strong> per request.</p>
      </div>

      {/* Live counter */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-xs text-gray-500">{selected.length} / {MAX_CARDS} cards selected</span>
        <span className="font-display text-base" style={{ color: totalValue >= MIN_VALUE ? '#10b981' : '#f87171' }}>
          ${totalValue.toFixed(2)}
        </span>
      </div>

      {selError && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl mb-3"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={12} style={{ color: '#f87171' }} />
          <p className="text-[11px] text-red-400">{selError}</p>
        </div>
      )}

      {/* Card grid */}
      {loadingInv ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: '#9b5cff' }} />
        </div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-14">
          <Package size={38} className="mx-auto mb-3" style={{ color: '#374151' }} />
          <p className="text-gray-600 text-sm">Your inventory is empty.</p>
        </div>
      ) : (() => {
        const totalPages = Math.ceil(inventory.length / CARDS_PER_PAGE);
        const safeCurrentPage = Math.min(currentPage, totalPages || 1);
        const startIndex = (safeCurrentPage - 1) * CARDS_PER_PAGE;
        const pageCards = inventory.slice(startIndex, startIndex + CARDS_PER_PAGE);

        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {pageCards.map(item => {
                const isSelected = selectedIds.has(item.id);
                const rc = rarityColor(item.rarity);
                return (
                  <motion.button key={item.id} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => onToggleCard(item)}
                    className="relative text-left rounded-xl overflow-hidden transition-all"
                    style={{
                      background: isSelected ? `${rc}15` : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${isSelected ? rc + '77' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: isSelected ? `0 0 20px -5px ${rc}44` : 'none',
                    }}>
                    <div className="w-full aspect-[3/4] flex items-center justify-center overflow-hidden"
                      style={{ background: 'rgba(0,0,0,0.3)' }}>
                      {item.cardImageUrl
                        ? <img src={item.cardImageUrl} alt={item.cardName} className="w-full h-full object-cover" />
                        : <span className="text-4xl">{item.emoji ?? '🃏'}</span>}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] font-semibold text-white leading-tight truncate">{item.cardName}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                          style={{ background: `${rc}18`, color: rc }}>
                          {item.rarity}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: '#10b981' }}>${item.value.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Selected indicator overlay */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full"
                        style={{ background: '#10b981', color: '#fff', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }}>
                        <CheckCircle size={14} strokeWidth={3} />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <ChevronLeft size={18} className="text-white" />
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest opacity-40">Page</span>
                  <span className="text-sm font-bold text-white px-3 py-1 rounded-lg" style={{ background: 'rgba(155,92,255,0.2)', border: '1px solid rgba(155,92,255,0.3)' }}>
                    {safeCurrentPage}
                  </span>
                  <span className="text-xs font-bold text-white opacity-20">/</span>
                  <span className="text-sm font-bold text-white/50">{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <ChevronRight size={18} className="text-white" />
                </button>
              </div>
            )}
          </>
        );
      })()}

      <motion.button
        whileHover={canContinue ? { scale: 1.02, y: -1 } : {}}
        whileTap={canContinue ? { scale: 0.97 } : {}}
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-display text-base uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canContinue ? 'linear-gradient(135deg,#9b5cff,#7c3aed)' : 'rgba(255,255,255,0.06)',
          boxShadow: canContinue ? '0 0 28px -6px rgba(155,92,255,0.65)' : 'none',
          color: '#fff',
        }}
      >
        Continue <ChevronRight size={16} />
      </motion.button>
    </motion.div>
  );
};
