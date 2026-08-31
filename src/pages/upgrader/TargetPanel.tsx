import React from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { RARITY_COLOR, TargetCard } from './constants';
import { TargetCardTile } from './CardTiles';
import { RarityFilters } from './RarityFilters';

interface TargetPanelProps {
  filteredTargets: TargetCard[];
  totalUpgradeValue: number;
  targetValue: number;
  multiplierLabel: string;
  search: string;
  setSearch: (v: string) => void;
  rarityFilter: string;
  setRarityFilter: (v: string) => void;
  minValue: string;
  setMinValue: (v: string) => void;
  maxValue: string;
  setMaxValue: (v: string) => void;
  selectedTargets: TargetCard[];
  toggleTarget: (card: TargetCard) => void;
  perTargetChance: number;
  selectedCardsCount: number;
  chanceForTarget: (targetCard: TargetCard) => number;
  paginatedTargets: TargetCard[];
  page: number;
  setPage: (v: number) => void;
  totalPages: number;
}

export function TargetPanel({
  filteredTargets,
  totalUpgradeValue,
  targetValue,
  multiplierLabel,
  search,
  setSearch,
  rarityFilter,
  setRarityFilter,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
  selectedTargets,
  toggleTarget,
  perTargetChance,
  selectedCardsCount,
  chanceForTarget,
  paginatedTargets,
  page,
  setPage,
  totalPages,
}: TargetPanelProps) {

  const inputBaseStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.08)',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(155,92,255,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(155,92,255,0.08)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div
      className="flex flex-col rounded-2xl border border-white/5 overflow-hidden"
      style={{ background: 'rgba(13,14,20,0.95)' }}
    >

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm uppercase tracking-widest text-white">
              Target Cards
            </h2>
            {totalUpgradeValue >= 0.5 && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                Near <span className="text-[#a78bfa] font-bold">${targetValue.toFixed(2)}</span>
                <span className="text-gray-600 mx-1">·</span>
                {multiplierLabel} of ${totalUpgradeValue.toFixed(2)}
              </p>
            )}
          </div>
          {/* Filter icon — visual only */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center cursor-default"
            style={{ background: 'rgba(155,92,255,0.1)', border: '1.5px solid rgba(155,92,255,0.2)' }}
            title="Filters active"
          >
            <SlidersHorizontal size={14} style={{ color: '#a78bfa' }} />
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search targets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-all duration-200"
            style={inputBaseStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        {/* Rarity filter pills */}
        <RarityFilters value={rarityFilter} onChange={setRarityFilter} />

        {/* Min / Max value inputs */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">$</span>
            <input
              type="number"
              placeholder="Min"
              value={minValue}
              onChange={e => setMinValue(e.target.value)}
              className="w-full rounded-xl pl-6 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-all duration-200"
              style={inputBaseStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">$</span>
            <input
              type="number"
              placeholder="Max"
              value={maxValue}
              onChange={e => setMaxValue(e.target.value)}
              className="w-full rounded-xl pl-6 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none transition-all duration-200"
              style={inputBaseStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
        </div>
      </div>

      {/* ── Target card grid ── */}
      <div className="flex-1 p-4 min-h-[420px]">
        {filteredTargets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-3xl">🔍</p>
            <p className="text-gray-500 text-xs">No cards match your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {paginatedTargets.map((card, i) => {
                const isSelected = selectedTargets.some(c => c.cardId === card.cardId);
                return (
                  <motion.div
                    key={card.cardId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <TargetCardTile
                      card={card}
                      selected={isSelected}
                      onClick={() => toggleTarget(card)}
                    />
                  </motion.div>
                );
              })}
              {paginatedTargets.length < 12 &&
                Array.from({ length: 12 - paginatedTargets.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-[3/4] rounded-xl border border-dashed border-white/5 opacity-20"
                  />
                ))}
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
                            ? { background: '#9b5cff', color: '#fff' }
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

      {/* ── Selected targets summary ── */}
      {selectedTargets.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Selected targets
            </p>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: '#a78bfa20', color: '#a78bfa' }}
            >
              {selectedTargets.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTargets.map(c => {
              const col = RARITY_COLOR[c.rarity] ?? '#9ca3af';
              return (
                <button
                  key={c.cardId}
                  onClick={() => toggleTarget(c)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all hover:opacity-80"
                  style={{
                    background: `${col}15`,
                    border: `1.5px solid ${col}40`,
                    color: col,
                  }}
                >
                  {c.cardImageUrl && (
                    <img src={c.cardImageUrl} alt="" className="w-3 h-4 object-contain rounded" />
                  )}
                  <span className="truncate max-w-[70px]">{c.name}</span>
                  <span className="text-gray-500 ml-0.5">✕</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
