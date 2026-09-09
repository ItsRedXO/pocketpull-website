// ─── Battle Utilities ──────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generatePrivateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const RARITY_COLORS: Record<string, string> = {
  common: '#8892a4',
  uncommon: '#10b981',
  rare: '#00c8ff',
  ultra: '#9b5cff',
  secret: '#ffd700',
  god: '#ff00ff',
};

export const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(136,146,164,0.3)',
  uncommon: 'rgba(16,185,129,0.4)',
  rare: 'rgba(0,200,255,0.4)',
  ultra: 'rgba(155,92,255,0.5)',
  secret: 'rgba(255,215,0,0.5)',
  god: 'rgba(255,0,255,0.6)',
};

export const MODE_INFO: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  standard: { label: 'Standard', icon: '⚔️', desc: 'Highest total value wins all cards.', color: '#00c8ff' },
  underdog: { label: 'Underdog', icon: '🔄', desc: 'Lowest total value wins all cards.', color: '#9b5cff' },
  shared: { label: 'Shared', icon: '🤝', desc: 'All players split rewards evenly.', color: '#10b981' },
};
