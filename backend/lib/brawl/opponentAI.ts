import { typeMultiplier, type PokeType } from './typeChart';

export interface OpponentCandidate {
  id: number;
  primaryType: PokeType;
  secondaryType: PokeType | null;
  overall: number;
}

export interface PlayerTypeProfile {
  primaryType: PokeType;
  secondaryType: PokeType | null;
}

// 0 = fully random (Local Battle / Local Tournament -- these should feel like
// scrappy, unplanned opposition), 1 = State, 2 = Regional, 3 = Elite Four.
// Each step narrows the shortlist the "trainer" actually picks from and leans
// harder into countering the player's team (see tuning below), so the same
// roster-selection code produces a visibly smarter opponent at higher tiers
// while never being fully deterministic -- the shortlist is still shuffled
// and sampled from, not just sorted-and-sliced.
export type StrategyLevel = 0 | 1 | 2 | 3;

interface StrategyTuning { resistWeight: number; offenseWeight: number; repeatPenalty: number; shortlist: number; }
const TUNING: Record<Exclude<StrategyLevel, 0>, StrategyTuning> = {
  1: { resistWeight: 1.0, offenseWeight: 0.6, repeatPenalty: 0.6, shortlist: 10 },
  2: { resistWeight: 1.6, offenseWeight: 1.1, repeatPenalty: 0.9, shortlist: 6 },
  3: { resistWeight: 2.2, offenseWeight: 1.6, repeatPenalty: 1.2, shortlist: 3 },
};

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// How much a hit of `attackType` should worry this candidate: 0 if it
// resists/is immune, 1 neutral, up to 4 if doubly weak.
function threatFrom(attackType: PokeType, candidate: OpponentCandidate): number {
  return typeMultiplier(attackType, [candidate.primaryType, candidate.secondaryType]);
}

// How hard the candidate's own STAB types would hit the player's roster,
// averaged across the player's Pokemon (best of the candidate's own two types
// against each one, since a real trainer picks whichever move lands).
function offenseAgainst(candidate: OpponentCandidate, playerTeam: PlayerTypeProfile[]): number {
  if (!playerTeam.length) return 1;
  const attackTypes = [candidate.primaryType, candidate.secondaryType].filter((t): t is PokeType => !!t);
  const perTarget = playerTeam.map(p => Math.max(...attackTypes.map(t => typeMultiplier(t, [p.primaryType, p.secondaryType]))));
  return perTarget.reduce((sum, v) => sum + v, 0) / perTarget.length;
}

// Higher is safer for the candidate: 2 (immune to everything the player can
// throw) down to 0 (double-weak to everything the player can throw).
function resistScore(candidate: OpponentCandidate, playerTeam: PlayerTypeProfile[]): number {
  if (!playerTeam.length) return 1;
  const attackTypes = new Set<PokeType>();
  for (const p of playerTeam) { attackTypes.add(p.primaryType); if (p.secondaryType) attackTypes.add(p.secondaryType); }
  const threats = Array.from(attackTypes).map(t => threatFrom(t, candidate));
  const avgThreat = threats.reduce((sum, v) => sum + v, 0) / threats.length;
  return 2 - avgThreat;
}

/**
 * Builds one opponent roster from a pre-filtered (by overall_rating band)
 * candidate pool. At strategyLevel 0 this is a plain random sample -- same
 * behavior as the old pickRandomSpeciesIds. At higher levels it greedily
 * drafts one Pokemon at a time, scoring each remaining candidate on how well
 * it resists the player's team's types, how hard its own types hit the
 * player's team, and a penalty for repeating a type already drafted (so the
 * roster doesn't degenerate into 6 of the same type) -- then samples from a
 * shortlist of the top scorers (shortlist shrinks per tier) rather than
 * always taking the single best, so results stay varied run to run.
 */
export function pickOpponentTeam(
  candidates: OpponentCandidate[],
  count: number,
  playerTeam: PlayerTypeProfile[],
  level: StrategyLevel,
): OpponentCandidate[] {
  const pool = shuffled(candidates);
  if (level === 0 || pool.length <= count) return pool.slice(0, count);

  const tuning = TUNING[level];
  const remaining = pool.slice();
  const chosen: OpponentCandidate[] = [];
  const typeCounts = new Map<PokeType, number>();

  while (chosen.length < count && remaining.length) {
    let bestIdx = 0;
    const scored = remaining.map((c, idx) => {
      const repeats = (typeCounts.get(c.primaryType) || 0) + (c.secondaryType ? (typeCounts.get(c.secondaryType) || 0) : 0);
      const score = tuning.resistWeight * resistScore(c, playerTeam) + tuning.offenseWeight * offenseAgainst(c, playerTeam) - tuning.repeatPenalty * repeats;
      return { idx, score };
    }).sort((a, b) => b.score - a.score);
    bestIdx = scored[Math.floor(Math.random() * Math.min(tuning.shortlist, scored.length))].idx;

    const [picked] = remaining.splice(bestIdx, 1);
    chosen.push(picked);
    typeCounts.set(picked.primaryType, (typeCounts.get(picked.primaryType) || 0) + 1);
    if (picked.secondaryType) typeCounts.set(picked.secondaryType, (typeCounts.get(picked.secondaryType) || 0) + 1);
  }
  return chosen;
}
