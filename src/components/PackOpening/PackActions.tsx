import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, DollarSign, CheckCircle } from 'lucide-react';

interface CardResult {
  name: string;
  emoji: string;
  rarity: string;
  value: number;
}

interface PackActionsProps {
  stage: 'idle' | 'opening' | 'reveal' | 'done';
  flipped: boolean;
  card: CardResult | null;
  actionMsg: string | null;
  saving: boolean;
  rarityColor: string;
  openAnotherButtonTextColor?: string;
  onSell: () => void;
  onClose: () => void;
}

export const PackActions: React.FC<PackActionsProps> = ({
  stage,
  flipped,
  card,
  actionMsg,
  saving,
  rarityColor,
  openAnotherButtonTextColor,
  onSell,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {stage === 'reveal' && flipped && card && !actionMsg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-1">
            Card secured in your collection
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-4 font-display text-sm uppercase tracking-wider rounded-xl border border-white/10 hover:border-white/25 text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Star size={15} /> Close
            </button>
            <button
              onClick={onSell}
              disabled={saving}
              className="flex-1 py-4 font-display text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 transition-all"
              style={{
                background: `${rarityColor}20`,
                border: `1px solid ${rarityColor}50`,
                color: rarityColor,
              }}
            >
              <DollarSign size={15} /> Sell — ${card.value.toFixed(2)}
            </button>
          </div>
        </motion.div>
      )}

      {(stage === 'done' || actionMsg) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {actionMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
            >
              <CheckCircle size={15} className="shrink-0" />
              {actionMsg}
            </motion.div>
          )}
          <button
            onClick={onClose}
            className="w-full py-4 font-display rounded-xl text-sm uppercase tracking-wider font-bold transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #00c8ff, #9b5cff)', color: openAnotherButtonTextColor || '#000' }}
          >
            Open Another Pack
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
