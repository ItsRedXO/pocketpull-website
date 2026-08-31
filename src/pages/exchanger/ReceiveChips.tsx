import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type MarketCard, RARITY_COLORS } from './exchangerTypes';

interface ReceiveChipsProps {
  marketCards: MarketCard[];
  receiveIds: Set<string>;
  onRemove: (id: string) => void;
}

export const ReceiveChips: React.FC<ReceiveChipsProps> = ({ marketCards, receiveIds, onRemove }) => {
  const cards = marketCards.filter(c => receiveIds.has(c.id));

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {cards.map(c => {
        const col = RARITY_COLORS[c.rarity] ?? '#888';
        return (
          <motion.div key={c.id}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
            className="flex items-center gap-4 px-3 py-3 rounded-2xl"
            style={{ background: col + '15', border: `1px solid ${col}30` }}>
            <div className="w-16 h-20 bg-black/40 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-lg">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl">🎴</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white truncate leading-tight mb-0.5">{c.name}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: col }}>{c.rarity}</p>
            </div>
            <div className="text-right shrink-0 pr-1">
              <p className="text-[15px] text-[#ffd700] font-display font-bold">${c.value.toFixed(2)}</p>
            </div>
            <button onClick={() => onRemove(c.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-400/15 transition-all shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
};