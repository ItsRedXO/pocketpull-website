import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

interface Props {
  card: {
    cardName: string;
    rarity: string;
    value: number;
    cardImageUrl?: string | null;
    createdAt?: string;
    packName?: string | null;
    id: string;
  } | null;
  onClose: () => void;
}

const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};

export const CardPreviewModal: React.FC<Props> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-lg bg-[#0d0f1c] rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="w-full md:w-1/2 p-6 bg-black/40 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
              <div className="relative group">
                {card.cardImageUrl ? (
                  <img
                    src={card.cardImageUrl}
                    alt={card.cardName}
                    className="w-full h-auto max-h-[300px] object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-40 h-56 rounded-xl bg-white/5 flex items-center justify-center">
                    <span className="text-4xl">🃏</span>
                  </div>
                )}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at center, ${RARITY_COLOR[card.rarity] || '#fff'} 0%, transparent 70%)` }}
                />
              </div>
            </div>

            {/* Details Section */}
            <div className="w-full md:w-1/2 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-display text-white uppercase leading-tight truncate">{card.cardName}</h3>
                  <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: RARITY_COLOR[card.rarity] }}>
                    {card.rarity}
                  </p>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Market Value</p>
                  <p className="text-2xl font-display font-bold text-[#10b981]">${card.value.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <DetailItem label="Inventory ID" value={card.id} />
                  {card.packName && <DetailItem label="Source Pack" value={card.packName} />}
                  {card.createdAt && (
                    <DetailItem 
                      label="Pulled At" 
                      value={new Date(card.createdAt).toLocaleString()} 
                    />
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-white/20 uppercase tracking-widest mb-0.5">{label}</p>
    <p className="text-[11px] text-white/70 font-medium truncate">{value}</p>
  </div>
);
