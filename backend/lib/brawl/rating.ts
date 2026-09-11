export interface BrawlBaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

// PokeAPI hands back each species' real base stats, which run well past 100
// for outliers (Chansey HP 250, Onix/Cloyster DEF 160-180, Mewtwo SpA 154)
// while the bulk of stats across the dex sit in the 20-130 range. Every stat
// gets pushed through this curve before it's ever stored in brawl_pokemon_species,
// so 100 means the same thing everywhere: the single most extreme real stat in
// the dex (or close to it), not "a decent legendary". A "very good" real stat
// (100-130, e.g. Gyarados' 125 Attack) lands in the mid-70s to mid-80s instead
// of maxing out, and only a genuine statistical outlier clamps all the way to
// 100 -- so a species with two 100s at once should be rare to nonexistent,
// same as in the source data.
export const STAT_SCALE_REF = 160;
export const STAT_SCALE_GAMMA = 0.9;

export function scaleBaseStat(raw: number): number {
  const ratio = Math.max(0, Math.min(1, raw / STAT_SCALE_REF));
  return Math.max(1, Math.min(100, Math.round(100 * Math.pow(ratio, STAT_SCALE_GAMMA))));
}

// Overall is a Madden-style weighted composite, not a flat average: a
// specialist's headline stat should carry it toward an elite rating even if
// its other stats are unremarkable (Dragonite's monster Attack should read
// as a genuine standout, not get diluted into mediocrity by its middling
// HP/Speed). Weighting 50% best stat + 30% second-best + 20% the remaining
// four keeps balanced generalists close to their old average while letting
// true specialists (and anything maxed on a single stat) climb toward the
// 90s. Result is still 1-100-scaled since every input already is.
export function computeOverallRating(stats: BrawlBaseStats): number {
  const values = [stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed].sort((a, b) => b - a);
  const [best, second, ...rest] = values;
  const restAvg = rest.reduce((sum, v) => sum + v, 0) / rest.length;
  const weighted = 0.5 * best + 0.3 * second + 0.2 * restAvg;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}
