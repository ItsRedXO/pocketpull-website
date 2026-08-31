import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { usePacks, type PackCatalog } from '../../hooks/usePacks';
import { RARITY_COLORS } from './battleUtils';

interface Props {
  onSelect: (pack: PackCatalog) => void;
  onClose: () => void;
  maxPrice?: number;
}

const SORT_OPTIONS = [
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'name-asc', label: 'Name A–Z' },
];

export const PackSelectorModal: React.FC<Props> = ({ onSelect, onClose }) => {
  const { data: packs = [], isLoading } = usePacks();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('price-asc');
  const [maxPrice, setMaxPrice] = useState(500);

  const filtered = useMemo(() => {
    let list = packs.filter(p => {
      const isStandardPack = p.packType === 'standard';
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchPrice = p.price <= maxPrice;
      const isActive = Number(p.isActive) > 0;
      
      // Eligibility rules:
      // 1. No cooldown (not a daily pack)
      // 2. No expiration date (not a timed/event pack)
      // 3. No quantity limit (not a limited pack)
      const noCooldown = Number(p.cooldownHours || 0) === 0;
      const noExpiration = !p.expiresAt;
      const noLimit = Number(p.quantityLimit || 0) === 0;
      
      return isStandardPack && matchSearch && matchPrice && isActive && noCooldown && noExpiration && noLimit;
    });
    if (sortBy === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [packs, search, sortBy, maxPrice]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #141520 0%, #0e0f1a 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 bg-white/[0.02]">
          <h2 className="font-display text-2xl uppercase tracking-wide text-white">Select Pack</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-white/6 space-y-4 bg-white/[0.01]">
          <div className="flex gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search packs..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none pr-8 cursor-pointer"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-[#141520]">{o.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Price slider */}
          <div className="flex items-center gap-4 py-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[140px]">Max price: <span className="text-white font-bold">${maxPrice}</span></span>
            <input
              type="range"
              min={1}
              max={1000}
              value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-white/10"
              style={{ accentColor: '#ffffff' }}
            />
          </div>
        </div>

        {/* Pack grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-44 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {filtered.map((pack, i) => (
                  <PackCard key={pack.id} pack={pack} index={i} onSelect={onSelect} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-20">
                  <p className="text-gray-600 uppercase tracking-[0.2em] text-xs">No active packs match your filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

function PackCard({ pack, index, onSelect }: { pack: PackCatalog; index: number; onSelect: (p: PackCatalog) => void }) {
  const glow = pack.glowColor || '#00c8ff';
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(pack)}
      className="relative text-left rounded-xl p-4 flex flex-col gap-3 group transition-all border border-white/5 hover:border-white/20"
      style={{
        background: 'rgba(255,255,255,0.03)',
        boxShadow: `0 0 20px -10px ${glow}44`,
      }}
    >
      <div className="relative h-28 w-full flex items-center justify-center mb-1">
        {/* Glow backdrop */}
        <div className="absolute inset-0 opacity-20 blur-2xl rounded-full pointer-events-none" style={{ background: glow }} />
        {pack.imageUrl ? (
          <img 
            src={pack.imageUrl} 
            alt={pack.name} 
            className="h-full w-auto object-contain relative z-10 transition-transform duration-500 group-hover:scale-110" 
            style={{ filter: `drop-shadow(0 0 10px ${glow}44)` }}
          />
        ) : (
          <ImageIcon size={32} className="text-white/20" />
        )}
      </div>

      <div className="space-y-1">
        <p className="font-display text-[13px] uppercase leading-tight tracking-wide text-white truncate">{pack.name}</p>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-bold text-white">${pack.price}</p>
          {pack.quantityLimit > 0 && (
            <span className={`text-[9px] font-bold uppercase tracking-widest ${pack.currentQuantity <= 10 ? 'text-red-400' : 'text-green-500/60'}`}>
              {pack.currentQuantity} Left
            </span>
          )}
        </div>
      </div>

      <div className="w-full py-2 rounded-lg text-[10px] font-bold uppercase text-center text-black transition-all bg-white group-hover:bg-white brightness-90 group-hover:brightness-110">
        Add to Battle
      </div>
    </motion.button>
  );
}
