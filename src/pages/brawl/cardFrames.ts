import type { CardTier } from './PokemonStatCard';

// Tier-specific card frame artwork (sci-fi border + tier name baked into the
// art itself). Each is a 1024x1536 (2:3) transparent PNG with the same
// layout -- header boxes, an open center window, name bar, tier bar, and 4
// stat slots -- measured once by sampling pixel alpha/luminance and reused
// as percentage coordinates in PokemonStatCard.
const FRAME_BASE = '/brawl/frames';
export const CARD_FRAMES: Record<CardTier, string> = {
  bronze: `${FRAME_BASE}/bronze.png`,
  silver: `${FRAME_BASE}/silver.png`,
  gold: `${FRAME_BASE}/gold.png`,
  legendary: `${FRAME_BASE}/legendary.png`,
};
