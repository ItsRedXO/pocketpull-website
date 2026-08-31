// ─── PACK ────────────────────────────────────────────────────────────────────
// Shared Pack interface used by pack-opening modals and homepage sections.
// Actual pack data comes from the database via usePacks() hook.

export interface Pack {
  id: string;
  name: string;
  price: number;
  tier: 'low' | 'mid' | 'high';
  emoji: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret' | 'god';
  borderColor: string;
  glowColor: string;
  description: string;
  odds: { common: number; uncommon: number; rare: number; ultra: number; secret: number };
  totalOpened: string;
  featured: boolean;
  hot?: boolean;
  featuredCards: string[];
  quantityLimit?: number;
  currentQuantity?: number;
  cooldownHours?: number;
  expiresAt?: string | null;
}
