import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { type InventoryCard, type SortOption, RARITY_COLORS, RARITY_ORDER } from './exchangerTypes';

interface InventoryPanelProps {
  user: any;
  inventory: InventoryCard[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  sort: SortOption;
  setSort: (s: SortOption) => void;
  category: string;
  setCategory: (c: string) => void;
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  pageSize: number;
  offerIds: Set<string>;
  toggleOffer: (card: InventoryCard) => void;
  clearSelection: () => void;
  maxOffer: number;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  user,
  inventory,
  loading,
  search,
  setSearch,
  sort,
  setSort,
  category,
  setCategory,
  page,
  setPage,
  pageSize,
  offerIds,
  toggleOffer,
  clearSelection,
  maxOffer
}) => {
  const filteredInv = React.useMemo(() => {
    let list = inventory.filter(c => {
      if (category !== 'all' && c.rarity !== category) return false;
      if (search && !c.cardName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    switch (sort) {
      case 'highest': list = list.sort((a, b) => b.value - a.value); break;
      case 'lowest':  list = list.sort((a, b) => a.value - b.value); break;
      case 'newest':  list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'rarity':  list = list.sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0)); break;
      case 'alpha':   list = list.sort((a, b) => a.cardName.localeCompare(b.cardName)); break;
    }
    return list;
  }, [inventory, category, search, sort]);

  const totalPages = Math.ceil(filteredInv.length / pageSize);
  const pagedInv = filteredInv.slice(page * pageSize, (page + 1) * pageSize);
  const SUPPORTED_RARITIES = ['all', 'common', 'uncommon', 'rare', 'ultra', 'secret', 'god'];

  return (
    <div className="glass-card p-5 flex flex-col gap-4 h-fit">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg uppercase text-gray-200">Your Cards</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {filteredInv.length} cards · Total value: ${filteredInv.reduce((s, c) => s + c.value, 0).toFixed(2)}
            {offerIds.size > 0 && (
              <span className="text-[#00c8ff] ml-1">· {offerIds.size}/{maxOffer} selected</span>
            )}
          </p>
        </div>
        {offerIds.size > 0 && (
          <button onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#00c8ff] transition-colors">
            <RefreshCw size={11} /> Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your cards..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8ff]/40" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as SortOption)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none appearance-none pr-7 cursor-pointer">
            <option value="highest" className="bg-[#141520]">Highest</option>
            <option value="lowest"  className="bg-[#141520]">Lowest</option>
            <option value="newest"  className="bg-[#141520]">Newest</option>
            <option value="rarity"  className="bg-[#141520]">Rarity</option>
            <option value="alpha"   className="bg-[#141520]">A–Z</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Rarity pills */}
      <div className="flex gap-1.5 flex-wrap">
        {SUPPORTED_RARITIES.map(r => (
          <button key={r} onClick={() => setCategory(r)}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all"
            style={{
              background: category === r ? (RARITY_COLORS[r] ?? '#00c8ff') + '22' : 'rgba(255,255,255,0.05)',
              color: category === r ? (RARITY_COLORS[r] ?? '#00c8ff') : '#6b7280',
              border: `1px solid ${category === r ? (RARITY_COLORS[r] ?? '#00c8ff') + '40' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {r}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {!user ? (
        <div className="flex-1 flex items-center justify-center text-center py-12">
          <div>
            <div className="text-4xl mb-3">🔐</div>
            <p className="text-gray-500 text-sm">Sign in to view your inventory</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="text-[#00c8ff] animate-spin" />
        </div>
      ) : pagedInv.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-12">
          <div>
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-gray-500 text-sm">
              {inventory.length === 0
                ? 'No cards in your inventory yet. Open some packs!'
                : 'No cards match your filters.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-2">
              <AnimatePresence mode="popLayout">
                {pagedInv.map((card, i) => {
                  const color = RARITY_COLORS[card.rarity] ?? '#8892a4';
                  const isSelected = offerIds.has(card.id);
                  const atLimit = offerIds.size >= maxOffer && !isSelected;
                  return (
                    <motion.button
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.2 }}
                      whileHover={!atLimit ? { y: -3, scale: 1.04 } : {}}
                      whileTap={!atLimit ? { scale: 0.97 } : {}}
                      onClick={() => toggleOffer(card)}
                      disabled={atLimit}
                      className="relative rounded-xl p-2.5 text-left transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      style={{
                        background: isSelected ? `${color}18` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${isSelected ? color : color + '22'}`,
                        boxShadow: isSelected ? `0 0 16px -4px ${color}88` : 'none',
                      }}
                    >
                      {isSelected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5 z-10">
                          <CheckCircle2 size={13} style={{ color }} />
                        </motion.span>
                      )}
                      {card.cardImageUrl ? (
                        <img
                          src={card.cardImageUrl}
                          alt={card.cardName}
                          className="w-full h-16 object-contain mb-1.5 rounded"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="text-2xl text-center mb-1.5 leading-none">{card.emoji}</div>
                      )}
                      <p className="text-[10px] font-bold text-center leading-tight line-clamp-2">{card.cardName}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        <p className="text-[9px] font-bold text-center uppercase" style={{ color }}>{card.rarity}</p>
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
