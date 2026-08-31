import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { InventoryRow } from './constants';
import { InvCardTile, SelectedChip } from './CardTiles';
import { RarityFilters } from './RarityFilters';

interface InventoryPanelProps {
  inventory: InventoryRow[];
  loading: boolean;
  isAuthenticated: boolean;
  search: string;
  setSearch: (v: string) => void;
  rarityFilter: string;
  setRarityFilter: (v: string) => void;
  selectedCards: InventoryRow[];
  toggleCard: (card: InventoryRow) => void;
  invQuantityMap: Record<string, number>;
  filteredInventory: InventoryRow[];
  paginatedInventory: InventoryRow[];
  page: number;
  setPage: (v: number) => void;
  totalPages: number;
  selectedCardTotal: number;
}

export function InventoryPanel({
  inventory,
  loading,
  isAuthenticated,
  search,
  setSearch,
  rarityFilter,
  setRarityFilter,
  selectedCards,
  toggleCard,
  invQuantityMap,
  filteredInventory,
  paginatedInventory,
  page,
  setPage,
  totalPages,
  selectedCardTotal,
}: InventoryPanelProps) {
  return (
    <div
      className="flex flex-col rounded-2xl border border-white/5 overflow-hidden h-fit"
      style={{ background: 'rgba(13,14,20,0.95)' }}
    >

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-widest text-white">
            My Cards
          </h2>
          {inventory.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-gray-400">
              {inventory.length}
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.08)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(0,200,255,0.4)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,200,255,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Rarity filter pills + Total display */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <RarityFilters value={rarityFilter} onChange={setRarityFilter} />
          </div>
          {selectedCards.length > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-[10px] font-bold text-yellow-500/60 uppercase tracking-tight">Total:</span>
              <span className="text-[11px] font-display font-bold text-yellow-400">
                ${selectedCardTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">🔒</span>
            <p className="text-center text-gray-600 text-xs">Sign in to see your cards</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-3xl">📦</p>
            <p className="text-gray-500 text-xs">
              {inventory.length === 0 ? 'Open Packs to grow your collection!' : 'No cards match filters.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {paginatedInventory.map((card, i) => {
                const isSelected = selectedCards.some(c => c.id === card.id);
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <InvCardTile
                      card={card}
                      selected={isSelected}
                      qty={invQuantityMap[card.cardId] || 1}
                      onClick={() => toggleCard(card)}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3 border-t border-white/5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  ← Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    if (totalPages > 5) {
                      if (p !== 1 && p !== totalPages && (p < page - 1 || p > page + 1)) {
                        if (p === page - 2 || p === page + 2)
                          return <span key={p} className="text-gray-600 text-[10px]">…</span>;
                        return null;
                      }
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all"
                        style={
                          page === p
                            ? { background: '#00c8ff', color: '#000' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#6b7280' }
                        }
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Selected chips ── */}
      {selectedCards.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Selected
            </p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#00c8ff20', color: '#00c8ff' }}>
              {selectedCards.length}/12
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {selectedCards.map(c => (
                <SelectedChip key={c.id} card={c} onRemove={() => toggleCard(c)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
