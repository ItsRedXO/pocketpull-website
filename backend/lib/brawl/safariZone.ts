import type { SafariTierConfig } from './tiers';

export interface SpeciesRatingRow { id: number; overall_rating: number; }

/** Picks `count` species ids for one Safari Zone pull: each slot independently rolls
 * the tier's bonus chance for a higher-overall pull before falling back to its
 * guaranteed range. */
export function rollSafariPull(tier: SafariTierConfig, pool: SpeciesRatingRow[]): number[] {
  const guaranteed = pool.filter(s => s.overall_rating >= tier.overallMin && s.overall_rating <= tier.overallMax);
  const bonus = pool.filter(s => s.overall_rating >= tier.bonusOverallMin && s.overall_rating <= tier.bonusOverallMax);
  if (!guaranteed.length) throw new Error(`No species available for safari tier ${tier.tier}`);
  const picks: number[] = [];
  for (let i = 0; i < tier.count; i++) {
    const useBonus = bonus.length > 0 && Math.random() < tier.bonusChance;
    const source = useBonus ? bonus : guaranteed;
    picks.push(source[Math.floor(Math.random() * source.length)].id);
  }
  return picks;
}
