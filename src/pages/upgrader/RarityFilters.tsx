/**
 * Shared rarity filter pill buttons used in both InventoryPanel and TargetPanel.
 */
import React from 'react';
import { motion } from 'framer-motion';

const RARITY_PILL_CONFIG: Record<string, { label: string; color: string; glow: string; textActive: string }> = {
  all:      { label: 'All',      color: '#a78bfa', glow: '#a78bfa', textActive: '#fff' },
  common:   { label: 'Common',   color: '#9ca3af', glow: '#9ca3af', textActive: '#000' },
  uncommon: { label: 'Uncommon', color: '#4ade80', glow: '#4ade80', textActive: '#000' },
  rare:     { label: 'Rare',     color: '#60a5fa', glow: '#60a5fa', textActive: '#000' },
  ultra:    { label: 'Ultra',    color: '#c084fc', glow: '#c084fc', textActive: '#000' },
  secret:   { label: 'Secret',   color: '#fbbf24', glow: '#fbbf24', textActive: '#000' },
  god:      { label: 'GOD',      color: '#f43f5e', glow: '#f43f5e', textActive: '#fff' },
};

const RARITIES = ['all', 'common', 'uncommon', 'rare', 'ultra', 'secret', 'god'];

interface RarityFiltersProps {
  value: string;
  onChange: (r: string) => void;
  accentColor?: string; // override for active state if desired
}

export function RarityFilters({ value, onChange }: RarityFiltersProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RARITIES.map(r => {
        const cfg = RARITY_PILL_CONFIG[r];
        const isActive = value === r;

        return (
          <motion.button
            key={r}
            onClick={() => onChange(r)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="relative px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-200 overflow-hidden"
            style={
              isActive
                ? {
                      background: cfg.color,
                      color: cfg.textActive,
                      boxShadow: `0 0 14px -4px ${cfg.glow}90`,
                      border: `1.5px solid ${cfg.color}`,
                    }
                : {
                    background: `${cfg.color}12`,
                    border: `1.5px solid ${cfg.color}30`,
                    color: '#6b7280',
                  }
            }
          >
            {/* Hover shimmer on inactive */}
            {!isActive && (
              <span
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-full"
                style={{ background: `${cfg.glow}15` }}
              />
            )}
            <span className="relative z-10">{cfg.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
