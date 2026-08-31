import React from 'react';
import { Search, Filter } from 'lucide-react';
import { RARITY_COLORS } from './inventoryTypes';

interface InventoryFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  filter: string;
  onFilterChange: (val: string) => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}) => {
  const rarities = ['all', 'common', 'uncommon', 'rare', 'ultra', 'secret', 'god', 'rainbow'];

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search cards..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8ff]/40 transition-all"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-500" />
        {rarities.map(r => (
          <button
            key={r}
            onClick={() => onFilterChange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              filter === r ? 'text-black' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
            style={filter === r ? { background: RARITY_COLORS[r] || '#00c8ff' } : {}}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
};
