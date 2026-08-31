import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TcgDexCard } from '../../lib/tcgdex';
import { TcgDexCardImage } from './TcgDexCardImage';
import { mapRarity, RARITY_COLORS, formatPrice } from './utils';

interface CardInspectorProps {
  card: TcgDexCard;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClose: () => void;
}

export const CardInspector: React.FC<CardInspectorProps> = ({ card, isSelected, onToggleSelect, onClose }) => {
  if (!card) return null;
  
  const col = RARITY_COLORS[mapRarity(card.rarity)] ?? '#8892a4';
  const { display: pr, hasPrice } = formatPrice(card);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        className="w-full max-w-4xl bg-[#0d0f1c] rounded-3xl border border-white/10 overflow-hidden flex flex-col md:flex-row shadow-2xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full md:w-1/2 p-6 flex flex-col items-center justify-center bg-black/30">
          <TcgDexCardImage url={card.image} alt={card.name} className="w-full max-w-[320px] drop-shadow-[0_0_50px_rgba(155,92,255,0.4)] mb-6" />
          <div className="flex gap-2 flex-wrap justify-center">
            {(card.types || []).map(t => (
              <span key={t} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="w-full md:w-1/2 p-8 flex flex-col gap-5 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl text-white font-display uppercase leading-tight mb-1">{card.name}</h3>
              <p className="text-[#9b5cff] text-sm font-bold uppercase tracking-widest">{card.set}</p>
            </div>
            <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-5">
            <F label="Rarity" value={card.rarity || 'Unknown'} color={col} />
            <F label="Price" value={pr} color={hasPrice ? '#10b981' : undefined} />
            <F label="Category" value={card.category || 'N/A'} />
            <F label="Local ID" value={card.localId} />
            <F label="TCGDex ID" value={card.id} />
            {card.hp && <F label="HP" value={String(card.hp)} />}
            {card.stage && <F label="Stage" value={card.stage} />}
            {card.illustrator && <F label="Illustrator" value={card.illustrator} />}
          </div>

          {card.description && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <label className="text-[10px] uppercase text-white/30 block mb-2 font-bold tracking-widest">Description</label>
              <p className="text-white/70 text-xs leading-relaxed">{card.description}</p>
            </div>
          )}
          
          {card.effect && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <label className="text-[10px] uppercase text-white/30 block mb-2 font-bold tracking-widest">Card Effect</label>
              <p className="text-white/70 text-xs leading-relaxed">{card.effect}</p>
            </div>
          )}

          {(card.attacks || []).length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] uppercase text-white/30 block font-bold tracking-widest">Attacks</label>
              {card.attacks.map((a, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col gap-1.5 transition-colors hover:bg-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-sm">{a.name}</span>
                    {a.damage && <span className="text-[#9b5cff] font-bold text-sm">{a.damage}</span>}
                  </div>
                  {a.effect && <p className="text-white/50 text-[11px] leading-snug">{a.effect}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/40 text-xs font-bold uppercase hover:bg-white/5 transition-all">
              Close
            </button>
            <button 
              onClick={() => { onToggleSelect(); onClose(); }} 
              className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-white font-bold text-xs uppercase shadow-xl shadow-[#9b5cff20] hover:scale-[1.02] transition-all"
            >
              {isSelected ? 'Selected' : 'Add to Pack'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const F: React.FC<{ label: string; value: string; color?: string; className?: string }> = ({ label, value, color, className = '' }) => (
  <div className={className}>
    <label className="text-[10px] uppercase text-white/20 block mb-1 font-bold tracking-widest">{label}</label>
    <span className="text-white/90 font-bold text-sm truncate block" style={{ color }}>{value}</span>
  </div>
);
