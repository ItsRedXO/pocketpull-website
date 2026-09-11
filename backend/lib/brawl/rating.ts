export interface BrawlBaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

// PokeAPI hands back each species' real base stats, which run well past 100
// for outliers (Chansey HP 250, Onix/Snorlax 160, Cloyster DEF 180) while
// the bulk of stats across the dex sit in the 20-130 range. Every stat gets
// pushed through this curve before it's ever stored in brawl_pokemon_species.
//
// Below STAT_SCALE_REF, this is a plain power curve: a "very good" real stat
// (100-130, e.g. Gyarados' 125 Attack) lands in the mid-70s to mid-80s
// instead of maxing out. At or above STAT_SCALE_REF, a literal 100 should
// stay effectively unreachable -- "matched the single strongest real stat in
// the dex" isn't the same thing as "the best stat conceivable" -- so instead
// of clamping straight to 100, overflow gets compressed into
// STAT_SCALE_OVERFLOW_FLOOR..STAT_SCALE_OVERFLOW_MAX based on how far past
// the reference point the raw stat sits, up to STAT_SCALE_OVERFLOW_CEILING
// (comfortably above the highest real stat in the mainline series, Blissey's
// 255 HP). A species with two stats at 90+ should be rare to nonexistent,
// same as in the source data.
export const STAT_SCALE_REF = 160;
export const STAT_SCALE_GAMMA = 0.9;
export const STAT_SCALE_OVERFLOW_CEILING = 260;
export const STAT_SCALE_OVERFLOW_FLOOR = 90;
export const STAT_SCALE_OVERFLOW_MAX = 97;

export function scaleBaseStat(raw: number): number {
  if (raw < STAT_SCALE_REF) {
    const ratio = Math.max(0, raw / STAT_SCALE_REF);
    return Math.max(1, Math.round(100 * Math.pow(ratio, STAT_SCALE_GAMMA)));
  }
  const overflowRatio = Math.min(1, (raw - STAT_SCALE_REF) / (STAT_SCALE_OVERFLOW_CEILING - STAT_SCALE_REF));
  return Math.round(STAT_SCALE_OVERFLOW_FLOOR + (STAT_SCALE_OVERFLOW_MAX - STAT_SCALE_OVERFLOW_FLOOR) * overflowRatio);
}

// Legendaries/Mythicals get a rating floor: an actual Legendary Pokemon
// should never read as "mid" even if its real base stats are modest by dex
// standards (the Gen 1 birds top out around 90 per stat) -- the flag alone
// should guarantee at least a strong Gold-tier number.
export const LEGENDARY_OVERALL_FLOOR = 75;

// Overall is a Madden-style weighted composite, not a flat average: a
// specialist's headline stat should carry it toward an elite rating even if
// its other stats are unremarkable (Dragonite's monster Attack should read
// as a genuine standout, not get diluted into mediocrity by its middling
// HP/Speed). Weighting 50% best stat + 30% second-best + 20% the remaining
// four keeps balanced generalists close to their old average while letting
// true specialists (and anything maxed on a single stat) climb toward the
// 90s. Result is still 1-100-scaled since every input already is.
export function computeOverallRating(stats: BrawlBaseStats, isLegendaryOrMythical = false): number {
  const values = [stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed].sort((a, b) => b - a);
  const [best, second, ...rest] = values;
  const restAvg = rest.reduce((sum, v) => sum + v, 0) / rest.length;
  const weighted = 0.5 * best + 0.3 * second + 0.2 * restAvg;
  const rounded = Math.max(0, Math.min(100, Math.round(weighted)));
  return isLegendaryOrMythical ? Math.max(LEGENDARY_OVERALL_FLOOR, rounded) : rounded;
}
