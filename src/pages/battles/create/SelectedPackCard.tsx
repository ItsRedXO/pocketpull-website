import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PackCatalog } from '../../../hooks/usePacks';

interface SelectedPack extends PackCatalog {
  uniqueKey: string;
}

interface SelectedPackCardProps {
  pack: SelectedPack;
  onRemove: () => void;
  onDuplicate: () => void;
}

export const SelectedPackCard: React.FC<SelectedPackCardProps> = ({
  pack,
  onRemove,
  onDuplicate,
}) => {
  const isRainbow = pack.glowColor === 'rainbow';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      layout
      className="relative flex flex-col gap-1 w-36 rounded-xl p-4 group"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${isRainbow ? 'rgba(255,0,255,0.3)' : pack.borderColor + '33'}`,
        boxShadow: `0 0 20px -8px ${isRainbow ? 'rgba(255,0,255,0.3)' : pack.glowColor + '44'}`,
      }}
    >
      {/* Controls */}
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate"
          className="w-5 h-5 rounded-md bg-white/8 hover:bg-white/16 flex items-center justify-center transition-all text-[10px] text-white"
        >
          ⧉
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
          className="w-5 h-5 rounded-md bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center transition-all"
        >
          <X size={10} className="text-red-400" />
        </button>
      </div>

      <div className="aspect-[3/4] w-full mb-2 overflow-hidden rounded-lg bg-black/20 flex items-center justify-center">
        {pack.imageUrl ? (
          <img 
            src={pack.imageUrl} 
            alt={pack.name} 
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-3xl">📦</div>
        )}
      </div>

      <p className="font-display text-[10px] uppercase leading-tight line-clamp-2 text-gray-300">
        {pack.name}
      </p>
      <p className="font-display text-sm font-bold mt-auto" style={{ color: isRainbow ? '#ff00ff' : pack.glowColor }}>
        ${pack.price.toFixed(2)}
      </p>
    </motion.div>
  );
};
