import React from 'react';

interface InventoryStatsProps {
  totalCards: number;
  totalValue: number;
  rarePlus: number;
  favorites: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({
  totalCards,
  totalValue,
  rarePlus,
  favorites,
}) => {
  const statsList = [
    { label: 'Total Cards', value: totalCards.toString() },
    { label: 'Est. Value', value: `$${totalValue.toFixed(2)}` },
    { label: 'Rare+', value: rarePlus.toString() },
    { label: 'Favorites', value: favorites.toString() },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {statsList.map((stat) => (
        <div key={stat.label} className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(13,14,20,0.9)' }}>
          <p className="text-xl font-display" style={{ color: '#00c8ff' }}>{stat.value}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};
