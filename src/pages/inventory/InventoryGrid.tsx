import React from 'react';
import { Package } from 'lucide-react';
import { InventoryCard } from './inventoryTypes';
import { InventoryCardTile } from './InventoryCardTile';

interface InventoryGridProps {
  loading: boolean;
  groupedCount: number;
  filtered: InventoryCard[];
  selling: string | null;
  sellConfirm: string | null;
  onToggleLock: (card: InventoryCard) => void;
  onToggleFavorite: (card: InventoryCard) => void;
  onSetLightbox: (lightbox: { src: string; alt: string; rarityColor: string } | null) => void;
  onSetSellConfirm: (val: string | null) => void;
  onHandleSell: (card: InventoryCard) => void;
}

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  loading,
  groupedCount,
  filtered,
  selling,
  sellConfirm,
  onToggleLock,
  onToggleFavorite,
  onSetLightbox,
  onSetSellConfirm,
  onHandleSell,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
      </div>
    );
  }

  if (groupedCount === 0) {
    return (
      <div className="text-center py-24">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-display text-white uppercase mb-2">No Cards Yet</h2>
        <p className="text-gray-500 text-sm">Open packs to start building your collection!</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Package size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-display text-lg uppercase">No cards match your search</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-8">
      {filtered.map((card, i) => (
        <InventoryCardTile
          key={`${card.cardId}-${i}`}
          card={card}
          index={i}
          selling={selling}
          sellConfirm={sellConfirm}
          onToggleLock={onToggleLock}
          onToggleFavorite={onToggleFavorite}
          onSetLightbox={onSetLightbox}
          onSetSellConfirm={onSetSellConfirm}
          onHandleSell={onHandleSell}
        />
      ))}
    </div>
  );
};
