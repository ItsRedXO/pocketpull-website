import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CreditCard, Eye, ExternalLink, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { CardImageLightbox } from '../../../components/CardImageLightbox';
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
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [cashoutDetail, setCashoutDetail] = useState<any>(null);

  // Helper to parse image URL from description: |img:URL|
  const getCardImage = (desc: string) => {
    if (!desc) return null;
    const match = desc.match(/\|img:(.*?)\|/);
    return match ? match[1] : null;
  };

  // Helper to clean description (remove metadata)
  const cleanDescription = (txn: any) => {
    if (txn.type === 'deposit') return 'Deposit';
    if (txn.type === 'cashout') {
      const status = txn.status === 'Canceled' ? ' (Canceled)' : '';
      return `Cash Out${status}`;
    }
    if (txn.type === 'sell') return 'Card Sold';
    
    let desc = txn.description || txn.type;
    return desc.split(' |img:')[0];
  };

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
          {/* Transaction history - MOVED TO TOP */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(13,14,20,0.9)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h2 className="font-display text-base uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-[#00c8ff]" />
              Transaction History
            </h2>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn, i) => {
                  const cardImg = getCardImage(txn.description);
                  const isCashout = txn.type === 'cashout';
                  const isSell = txn.type === 'sell';
                  const isCanceled = txn.status === 'Canceled';
                  
                  return (
                    <div
                      key={i}
                      className={`flex flex-col gap-2 py-3 px-4 rounded-xl transition-all ${
                        (isSell || isCashout) ? 'cursor-pointer hover:bg-white/5 active:scale-[0.99]' : ''
                      }`}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                      onClick={() => {
                        if (isSell && cardImg) {
                          setLightbox({ src: cardImg, alt: 'Sold Card' });
                        } else if (isCashout && txn.rawRequest) {
                          setCashoutDetail(txn.rawRequest);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-display uppercase tracking-wider text-white">
                            {cleanDescription(txn)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {new Date(txn.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`font-display text-base font-bold transition-all ${
                            isCanceled ? 'text-gray-600 line-through' : 'text-green-400'
                          }`}>
                            {txn.type === 'deposit' || isSell ? '+' : ''}${Math.abs(Number(txn.amount)).toFixed(2)}
                            {isCashout && <span className="text-[10px] text-gray-500 ml-1.5 uppercase font-sans tracking-tight no-underline">card value</span>}
                          </span>
                          {isCanceled && (
                            <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Canceled</span>
                          )}
                        </div>
                      </div>

                      {isSell && cardImg && (
                        <div className="flex items-center gap-3 pt-1">
                          <div 
                            className="w-8 h-10 rounded bg-black/40 border border-white/10 overflow-hidden cursor-pointer active:scale-95 transition-transform"
                            onClick={() => setLightbox({ src: cardImg, alt: 'Sold Card' })}
                          >
                            <img src={cardImg} alt="Sold Card" className="w-full h-full object-cover" />
                          </div>
                          <button
                            onClick={() => setLightbox({ src: cardImg, alt: 'Sold Card' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-all font-bold uppercase tracking-wider"
                          >
                            <Eye size={12} />
                            View Card
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Transaction Pagination */}
                {totalTx > pageSize && (
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => setTxPage(Math.max(1, txPage - 1))}
                      disabled={txPage === 1}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Page</span>
                      <span className="text-sm font-display text-white">{txPage}</span>
                      <span className="text-[10px] text-gray-600 font-bold">/</span>
                      <span className="text-[10px] text-gray-600 font-bold">{Math.ceil(totalTx / pageSize)}</span>
                    </div>
                    <button
                      onClick={() => setTxPage(Math.min(Math.ceil(totalTx / pageSize), txPage + 1))}
                      disabled={txPage >= Math.ceil(totalTx / pageSize)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pack history - MOVED TO BOTTOM */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(13,14,20,0.9)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h2 className="font-display text-base uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <Package size={16} className="text-[#9b5cff]" />
              Pack Opening History
            </h2>
            {packHistory.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No packs opened yet. Open your first pack!
              </p>
            ) : (
              <div className="space-y-2">
                {packHistory.map((pack, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                    style={{
                      background: 'rgba(155,92,255,0.05)',
                      border: '1px solid rgba(155,92,255,0.1)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{pack.packName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(pack.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-[#ffd700] font-display text-sm font-bold">
                      ${Number(pack.cost).toFixed(2)}
                    </span>
                  </div>
                ))}

                {/* Pack Pagination */}
                {totalPacks > pageSize && (
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5 mt-2">
                    <button
                      onClick={() => setPackPage(Math.max(1, packPage - 1))}
                      disabled={packPage === 1}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Page</span>
                      <span className="text-sm font-display text-white">{packPage}</span>
                      <span className="text-[10px] text-gray-600 font-bold">/</span>
                      <span className="text-[10px] text-gray-600 font-bold">{Math.ceil(totalPacks / pageSize)}</span>
                    </div>
                    <button
                      onClick={() => setPackPage(Math.min(Math.ceil(totalPacks / pageSize), packPage + 1))}
                      disabled={packPage >= Math.ceil(totalPacks / pageSize)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {lightbox && (
        <CardImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}

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
