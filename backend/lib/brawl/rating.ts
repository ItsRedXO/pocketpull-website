export interface BrawlBaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

// Overall = mean of the six base stats, rounded and clamped to 0-100 so every
// species (including top legendaries like Mewtwo) fits the 0-100 rating scale
// the rest of the game (Safari Zone tiers, opponent ranges) is built around.
export function computeOverallRating(stats: BrawlBaseStats): number {
  const sum = stats.hp + stats.attack + stats.defense + stats.spAttack + stats.spDefense + stats.speed;
  return Math.max(0, Math.min(100, Math.round(sum / 6)));
}
