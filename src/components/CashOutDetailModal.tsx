import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Calendar, MapPin, AlertCircle, RefreshCw, Undo2, Loader2 } from 'lucide-react';
import { blink, INVENTORY_CHANNEL, INVENTORY_UPDATED_EVENT } from '../lib/blink';
import { toast } from '@blinkdotnew/ui';

interface CashOutDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onCanceled: () => void;
}

export const CashOutDetailModal: React.FC<CashOutDetailModalProps> = ({ isOpen, onClose, request, onCanceled }) => {
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState('');

  if (!request) return null;

  const cards = JSON.parse(request.cardsJson || '[]');
  const isPending = request.status === 'pending';

  const handleCancel = async () => {
    if (!isPending || canceling) return;
    if (!confirm('Are you sure you want to cancel this cashout? Your cards will be returned to your inventory.')) return;

    setCanceling(true);
    setError('');

    try {
      // 1. Mark as canceled
      await blink.db.cashoutRequests.update(request.id, {
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });

      // 2. Return cards to inventory
      const returnPromises = cards.map((c: any) => {
        const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        return blink.db.inventory.create({
          id: invId,
          userId: request.userId,
          cardId: c.card_id || 'unknown',
          cardName: c.card_name,
          rarity: c.rarity,
          value: Number(c.value),
          cardImageUrl: c.card_image_url || null,
          packName: c.pack_name || null,
          emoji: c.emoji || '🃏',
          isLocked: 0,
          isFavorite: 0,
        });
      });

      await Promise.all(returnPromises);

      // 3. Notify app of inventory changes
      await blink.realtime.publish(`${INVENTORY_CHANNEL}-${request.userId}`, INVENTORY_UPDATED_EVENT, { 
        type: 'add_many', 
        message: 'Cards returned from canceled cashout'
      });

      toast.success('Cashout canceled successfully. Cards returned to inventory.');
      if (typeof onCanceled === 'function') onCanceled();
      onClose();
    } catch (err: any) {
      console.error('Cancel cashout failed:', err);
      setError(err?.message || 'Failed to cancel cashout. Please contact support.');
      toast.error('Failed to cancel cashout. Please contact support.');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="relative w-full max-w-2xl bg-[#0d0f1a] border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0d0f1a] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#9b5cff]/10 border border-[#9b5cff]/20 flex items-center justify-center">
                  <Package size={20} className="text-[#9b5cff]" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-white uppercase tracking-tight">Cashout Details</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">#{request.confirmationNumber}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Status</p>
                  <p className={`text-xs font-bold uppercase tracking-wider ${
                    request.status === 'pending' ? 'text-yellow-400' : 
                    request.status === 'Canceled' ? 'text-gray-500' : 'text-green-400'
                  }`}>
                    {request.status}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Cards</p>
                  <p className="text-sm font-display text-white">{request.totalCards}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Value</p>
                  <p className="text-sm font-display text-green-400 font-bold">${Number(request.totalValue).toFixed(2)}</p>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MapPin size={12} className="text-[#9b5cff]" />
                  Shipping Address
                </h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <p className="text-white font-bold">{request.shippingName}</p>
                  <p>{request.shippingAddress}</p>
                  <p>{request.shippingCity}, {request.shippingState} {request.shippingZip}</p>
                  <p className="text-[10px] text-gray-500 pt-1">US</p>
                </div>
              </div>

              {/* Card List */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Undo2 size={12} className="text-[#00c8ff]" />
                  Requested Cards
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {cards.map((card: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5">
                      <div className="w-10 h-14 rounded bg-black border border-white/10 overflow-hidden flex-shrink-0">
                        {card.card_image_url ? (
                          <img src={card.card_image_url} alt={card.card_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">🃏</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate leading-tight">{card.card_name}</p>
                        <p className="text-[9px] text-gray-500 uppercase tracking-tighter mt-1">{card.rarity}</p>
                        <p className="text-[10px] text-green-400 font-bold mt-0.5">${Number(card.value).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer / Actions */}
            {isPending && (
              <div className="p-6 border-t border-white/5 bg-black/20">
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {canceling ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Cancel Cash Out
                    </>
                  )}
                </button>
                <p className="text-[10px] text-gray-600 text-center mt-3 uppercase tracking-tighter">
                  Canceling will return all cards to your inventory immediately.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
