import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, ChevronDown } from 'lucide-react';
import { CATEGORIES, RARITY_COLORS, type MarketCard, type SortOption } from './exchangerTypes';

interface Props {
  marketCards: MarketCard[];
  maxValue: number;           // only show cards ≤ this value (0 = show all)
  selectedIds: Set<string>;
  onToggle: (card: MarketCard) => void;
  maxSelectable: number;
}

export const MarketPanel: React.FC<Props> = ({ marketCards, maxValue, selectedIds, onToggle, maxSelectable }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('highest');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const filtered = useMemo(() => {
    let list = marketCards.filter(c => {
      // If an offer is selected (maxValue > 0), only show cards ≤ that value.
      // If no cards are selected (maxValue === 0), show all cards.
      if (maxValue > 0 && c.value > maxValue + 0.01) return false;
      
      // Filter by price range state
      if (c.value < minPrice) return false;
      // If maxPrice is at the slider max (10000), treat it as no upper limit
      if (maxPrice < 10000 && c.value > maxPrice) return false;
      
      if (category !== 'All' && c.category !== category) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    switch (sortBy) {
      case 'highest': list = list.sort((a, b) => b.value - a.value); break;
      case 'lowest':  list = list.sort((a, b) => a.value - b.value); break;
      case 'alpha':   list = list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'rarity':  list = list.sort((a, b) => {
        const ORDER: Record<string, number> = { common:0, uncommon:1, rare:2, ultra:3, secret:4, god:5 };
        return (ORDER[b.rarity] ?? 0) - (ORDER[a.rarity] ?? 0);
      }); break;
    }
    return list;
  }, [marketCards, search, category, sortBy, minPrice, maxPrice, maxValue]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedMarket = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => setPage(0), [search, category, sortBy, minPrice, maxPrice, maxValue]);

  const atLimit = selectedIds.size >= maxSelectable;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg uppercase text-gray-200">PocketPull Market</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Browse and select cards to receive
          </p>
        </div>
        <span className="text-xs text-gray-600 font-bold">
          {selectedIds.size}/{maxSelectable} selected
        </span>
      </div>

      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8ff]/40"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none appearance-none pr-7 cursor-pointer"
          >
            <option value="highest" className="bg-[#141520]">Highest Value</option>
            <option value="lowest"  className="bg-[#141520]">Lowest Value</option>
            <option value="rarity"  className="bg-[#141520]">By Rarity</option>
            <option value="alpha"   className="bg-[#141520]">A–Z</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Price range */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[11px] text-gray-600 shrink-0">
          ${minPrice} – ${maxPrice === 10000 ? '10000+' : maxPrice}
        </span>
        <input type="range" min={0} max={10000} step={10} value={maxPrice}
          onChange={e => setMaxPrice(Number(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#00c8ff' }}
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all"
            style={{
              background: category === cat ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.05)',
              color: category === cat ? '#00c8ff' : '#6b7280',
              border: `1px solid ${category === cat ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <p className="text-gray-600 text-sm">No cards match your filters.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-2">
              <AnimatePresence mode="popLayout">
                {pagedMarket.map((card, i) => {
                  const color = RARITY_COLORS[card.rarity] ?? '#8892a4';
                  const isSelected = selectedIds.has(card.id);
                  const disabled = !isSelected && atLimit;
                  return (
                    <motion.button
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.2 }}
                      whileHover={!disabled ? { y: -3, scale: 1.04 } : {}}
                      whileTap={!disabled ? { scale: 0.97 } : {}}
                      onClick={() => !disabled && onToggle(card)}
                      disabled={disabled}
                      className="relative rounded-xl p-2.5 text-left transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      style={{
                        background: isSelected ? `${color}18` : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${isSelected ? color : color + '22'}`,
                        boxShadow: isSelected ? `0 0 16px -4px ${color}88` : 'none',
                      }}
                    >
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5"
                        >
                          <CheckCircle2 size={13} style={{ color }} />
                        </motion.span>
                      )}
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-16 object-contain mb-1.5 rounded"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="text-2xl text-center mb-1.5 leading-none">{card.emoji}</div>
                      )}
                      <p className="text-[10px] font-bold text-center leading-tight line-clamp-2">{card.name}</p>
                      <div className="flex flex-col items-center">
                        <p className="text-[9px] font-bold text-center uppercase"
                          style={{ color }}>{card.rarity}</p>
                        {card.packName && (
                          <p className="text-[7px] text-gray-500 uppercase truncate w-full text-center">{card.packName}</p>
                        )}
                      </div>
                      <p className="text-xs font-display text-center text-[#ffd700] mt-1">${card.value.toFixed(2)}</p>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold bg-white/5 hover:bg-white/10 transition-all disabled:opacity-20"
              >
                Prev
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  if (totalPages > 7) {
                    if (i !== 0 && i !== totalPages - 1 && (i < page - 1 || i > page + 1)) {
                      if (i === page - 2 || i === page + 2) return <span key={i} className="text-gray-600 text-[10px]">...</span>;
                      return null;
                    }
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                        page === i 
                          ? 'bg-[#00c8ff] text-black shadow-[0_0_10px_#00c8ff88]' 
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold bg-white/5 hover:bg-white/10 transition-all disabled:opacity-20"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
