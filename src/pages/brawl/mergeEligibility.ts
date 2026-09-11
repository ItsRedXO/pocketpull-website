import { EVOLVE_COST_STAGE_1, EVOLVE_COST_STAGE_2_PLUS, STAR_UPGRADE_FODDER_COUNT, MAX_STAR_LEVEL, type BrawlInstance } from '../../lib/brawlApi';

export function evolveCostFor(stage: number): number {
  return stage <= 1 ? EVOLVE_COST_STAGE_1 : EVOLVE_COST_STAGE_2_PLUS;
}

export interface MergeEligibility {
  unstarred: BrawlInstance[];
  evolveCost: number;
  canEvolve: boolean;
  starTarget: BrawlInstance | undefined;
  fodderPool: BrawlInstance[];
  canStarUp: boolean;
}

/** Single source of truth for "can this bench group of same-species instances
 * evolve and/or star-upgrade right now" -- used both to decide whether to
 * show the merge chip on the bench grid and to drive the actual merge modal,
 * so the two can never disagree about what's eligible. */
export function computeMergeEligibility(group: BrawlInstance[]): MergeEligibility {
  const species = group[0];
  const unstarred = group.filter(i => i.star_level === 0).slice().sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  const evolveCost = evolveCostFor(species.evolution_stage);
  const canEvolve = species.evolves_to.length > 0 && unstarred.length >= evolveCost;

  const starCandidates = group.slice().sort((a, b) => b.star_level - a.star_level || a.acquired_at.localeCompare(b.acquired_at));
  const starTarget = starCandidates.find(i => i.star_level < MAX_STAR_LEVEL);
  const fodderPool = unstarred.filter(i => i.id !== starTarget?.id);
  const canStarUp = !!starTarget && fodderPool.length >= STAR_UPGRADE_FODDER_COUNT;

  return { unstarred, evolveCost, canEvolve, starTarget, fodderPool, canStarUp };
}

export function groupIsMergeable(group: BrawlInstance[]): boolean {
  const { canEvolve, canStarUp } = computeMergeEligibility(group);
  return canEvolve || canStarUp;
}
