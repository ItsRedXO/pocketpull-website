import type { SafariTierConfig } from './tiers';

export interface SpeciesRatingRow { id: number; overall_rating: number; evolution_stage: number; is_legendary: number; is_mythical: number; }

/** Narrows the full species table down to a tier's themed pool (evolution stage
 * + Legendary/Mythical gating), falling back to progressively looser filters if
 * the strict pool comes up empty -- the overall-rating range is what actually
 * guarantees a pull always has candidates; stage/legendary gating is a
 * preference layered on top of it, not a hard requirement the pull can fail on. */
function themedPool(tier: SafariTierConfig, pool: SpeciesRatingRow[]): SpeciesRatingRow[] {
  const byStage = (s: SpeciesRatingRow) => !tier.stages || tier.stages.includes(s.evolution_stage);
  const byRarity = (s: SpeciesRatingRow) => (!tier.excludeLegendary || !s.is_legendary) && (!tier.excludeMythical || !s.is_mythical);

  const strict = pool.filter(s => byStage(s) && byRarity(s));
  if (strict.length) return strict;
  const rarityOnly = pool.filter(byRarity);
  if (rarityOnly.length) return rarityOnly;
  return pool;
}

/** Picks `count` species ids for one Safari Zone pull: each slot independently rolls
 * the tier's bonus chance for a higher-overall pull before falling back to its
 * guaranteed range. */
export function rollSafariPull(tier: SafariTierConfig, pool: SpeciesRatingRow[]): number[] {
  const themed = themedPool(tier, pool);
  const guaranteed = themed.filter(s => s.overall_rating >= tier.overallMin && s.overall_rating <= tier.overallMax);
  const bonus = themed.filter(s => s.overall_rating >= tier.bonusOverallMin && s.overall_rating <= tier.bonusOverallMax);
  // Guaranteed band came up empty even after relaxing stage/rarity gating (e.g. a
  // sparsely-seeded species table) -- widen to the full themed pool rather than
  // fail the pull outright.
  const guaranteedPool = guaranteed.length ? guaranteed : themed;
  if (!guaranteedPool.length) throw new Error(`No species available for safari tier ${tier.tier}`);
  const picks: number[] = [];
  for (let i = 0; i < tier.count; i++) {
    const useBonus = bonus.length > 0 && Math.random() < tier.bonusChance;
    const source = useBonus ? bonus : guaranteedPool;
    picks.push(source[Math.floor(Math.random() * source.length)].id);
  }
  return picks;
}
