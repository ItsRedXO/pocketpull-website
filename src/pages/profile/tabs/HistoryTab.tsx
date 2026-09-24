import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CreditCard, ChevronLeft, ChevronRight, X, Tag, Calendar, DollarSign, ArrowUpRight } from 'lucide-react';
import { CashOutDetailModal } from '../../../components/CashOutDetailModal';

interface HistoryTabProps {
  loadingHistory: boolean;
  packHistory: any[];
  transactions: any[];
  fetchHistory: () => void;
  txPage: number;
  setTxPage: (page: number) => void;
  packPage: number;
  setPackPage: (page: number) => void;
  totalTx: number;
  totalPacks: number;
  pageSize: number;
}

// Extract image URL from "Sold CardName |img:URL|"
function getCardImage(desc: string): string | null {
  if (!desc) return null;
  const match = desc.match(/\|img:(.*?)\|/);
  return match ? match[1] : null;
}

// Extract card name from "Sold CardName |img:URL|"
function getCardName(desc: string): string | null {
  if (!desc) return null;
  return desc.replace(/\s*\|img:.*?\|/g, '').replace(/^Sold\s+/i, '').trim() || null;
}

function cleanDescription(txn: any): string {
  if (txn.type === 'deposit') return 'Deposit';
  if (txn.type === 'cashout') return txn.status === 'Canceled' ? 'Cash Out (Canceled)' : 'Cash Out';
  if (txn.type === 'sell') return getCardName(txn.description) || 'Card Sold';
  const desc = txn.description || txn.type;
  return desc.split(' |img:')[0];
}

// ── Sell Detail Modal ────────────────────────────────────────────────────────
const SellDetailModal: React.FC<{ txn: any; onClose: () => void }> = ({ txn, onClose }) => {
  const cardImg = getCardImage(txn.description);
  const cardName = getCardName(txn.description) || 'Card Sold';
  const date = new Date(txn.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#0d0f1c', border: '1.5px solid rgba(16,185,129,0.3)', boxShadow: '0 0 60px -12px rgba(16,185,129,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Tag size={14} className="text-green-400" />
            </div>
            <span className="font-display text-sm uppercase tracking-wider text-white">Card Sold</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Card image */}
        {cardImg ? (
          <div className="flex justify-center py-6 px-4" style={{ background: 'rgba(16,185,129,0.04)' }}>
            <img
              src={cardImg}
              alt={cardName}
              className="max-h-48 w-auto object-contain rounded-lg"
              style={{ filter: 'drop-shadow(0 8px 24px rgba(16,185,129,0.3))' }}
            />
          </div>
        ) : (
          <div className="flex justify-center py-10 px-4" style={{ background: 'rgba(16,185,129,0.04)' }}>
            <div className="w-24 h-32 rounded-xl flex items-center justify-center text-4xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              🃏
            </div>
          </div>
        )}

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-3 py-3 px-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Tag size={14} className="text-white/30 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Card</p>
              <p className="text-sm text-white font-display uppercase tracking-wide mt-0.5">{cardName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 py-3 px-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <DollarSign size={14} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Sold for</p>
                <p className="text-base font-display font-bold text-green-400 mt-0.5">+${Math.abs(Number(txn.amount)).toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 py-3 px-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Calendar size={14} className="text-white/30 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Date</p>
                <p className="text-sm text-white font-medium mt-0.5">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
export const HistoryTab: React.FC<HistoryTabProps> = ({
  loadingHistory,
  packHistory,
  transactions,
  fetchHistory,
  txPage,
  setTxPage,
  packPage,
  setPackPage,
  totalTx,
  totalPacks,
  pageSize,
}) => {
  const [selectedSell, setSelectedSell] = useState<any | null>(null);
  const [cashoutDetail, setCashoutDetail] = useState<any>(null);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {loadingHistory ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
        </div>
      ) : (
        <>
          {/* Transaction history */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(13,14,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="font-display text-base uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-[#00c8ff]" />
              Transaction History
            </h2>

            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn, i) => {
                  const cardImg = getCardImage(txn.description);
                  const cardName = getCardName(txn.description);
                  const isCashout = txn.type === 'cashout';
                  const isSell = txn.type === 'sell';
                  const isCanceled = txn.status === 'Canceled';
                  const isClickable = isSell || isCashout;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all ${
                        isClickable ? 'cursor-pointer hover:bg-white/5 active:scale-[0.99] group' : ''
                      }`}
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                      onClick={() => {
                        if (isSell) setSelectedSell(txn);
                        else if (isCashout && txn.rawRequest) setCashoutDetail(txn.rawRequest);
                      }}
                    >
                      {/* Card thumbnail for sell rows */}
                      {isSell && cardImg && (
                        <div className="w-9 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black/40">
                          <img src={cardImg} alt={cardName || 'Card'} className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* No-image placeholder for sell rows without image */}
                      {isSell && !cardImg && (
                        <div className="w-9 h-12 rounded-lg shrink-0 flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                          🃏
                        </div>
                      )}

                      {/* Label + date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display uppercase tracking-wider text-white truncate">
                          {cleanDescription(txn)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Amount + arrow */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className={`font-display text-base font-bold ${isCanceled ? 'text-gray-600 line-through' : isSell ? 'text-green-400' : txn.type === 'deposit' ? 'text-green-400' : 'text-white'}`}>
                            {txn.type === 'deposit' || isSell ? '+' : ''}${Math.abs(Number(txn.amount)).toFixed(2)}
                          </span>
                          {isCashout && (
                            <span className="block text-[9px] text-gray-500 uppercase tracking-tight mt-0.5">card value</span>
                          )}
                          {isCanceled && (
                            <span className="block text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Canceled</span>
                          )}
                        </div>
                        {isClickable && (
                          <ArrowUpRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalTx > pageSize && (
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                    <button onClick={() => setTxPage(Math.max(1, txPage - 1))} disabled={txPage === 1}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all">
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Page</span>
                      <span className="text-sm font-display text-white">{txPage}</span>
                      <span className="text-[10px] text-gray-600 font-bold">/</span>
                      <span className="text-[10px] text-gray-600 font-bold">{Math.ceil(totalTx / pageSize)}</span>
                    </div>
                    <button onClick={() => setTxPage(Math.min(Math.ceil(totalTx / pageSize), txPage + 1))} disabled={txPage >= Math.ceil(totalTx / pageSize)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pack opening history */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(13,14,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="font-display text-base uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <Package size={16} className="text-[#9b5cff]" />
              Pack Opening History
            </h2>
            {packHistory.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No packs opened yet. Open your first pack!</p>
            ) : (
              <div className="space-y-2">
                {packHistory.map((pack, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                    style={{ background: 'rgba(155,92,255,0.05)', border: '1px solid rgba(155,92,255,0.1)' }}>
                    <div>
                      <p className="text-sm font-medium text-white">{pack.packName}</p>
                      <p className="text-xs text-gray-500">{new Date(pack.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[#ffd700] font-display text-sm font-bold">
                      ${Number(pack.cost).toFixed(2)}
                    </span>
                  </div>
                ))}

                {totalPacks > pageSize && (
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5 mt-2">
                    <button onClick={() => setPackPage(Math.max(1, packPage - 1))} disabled={packPage === 1}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all">
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Page</span>
                      <span className="text-sm font-display text-white">{packPage}</span>
                      <span className="text-[10px] text-gray-600 font-bold">/</span>
                      <span className="text-[10px] text-gray-600 font-bold">{Math.ceil(totalPacks / pageSize)}</span>
                    </div>
                    <button onClick={() => setPackPage(Math.min(Math.ceil(totalPacks / pageSize), packPage + 1))} disabled={packPage >= Math.ceil(totalPacks / pageSize)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Sell detail modal */}
      <AnimatePresence>
        {selectedSell && (
          <SellDetailModal txn={selectedSell} onClose={() => setSelectedSell(null)} />
        )}
      </AnimatePresence>

      {/* Cashout detail modal */}
      {cashoutDetail && (
        <CashOutDetailModal
          isOpen={!!cashoutDetail}
          onClose={() => setCashoutDetail(null)}
          request={cashoutDetail}
          onCanceled={fetchHistory}
        />
      )}
    </motion.div>
  );
};
