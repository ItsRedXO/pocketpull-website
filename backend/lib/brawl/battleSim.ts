import { typeMultiplier, effectivenessLabel, type PokeType } from './typeChart';
import { buildMoveset, type BrawlMove } from './moveLibrary';

export interface BattleSpecies {
  speciesId: number;
  name: string;
  primaryType: PokeType;
  secondaryType: PokeType | null;
  baseHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  overall: number;
  spriteUrl: string | null;
  artworkUrl: string | null;
}

type Side = 'user' | 'opponent';
type Effectiveness = 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';
interface Point { x: number; y: number; }

interface Fighter extends BattleSpecies {
  id: string;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  fainted: boolean;
  moves: BrawlMove[];
  cooldown: number;
  targetId: string | null;
  routeCorner: Point | null;
  stuckTicks: number;
}

export interface ArenaObstacle { x1: number; y1: number; x2: number; y2: number; }
export interface ArenaPokemonState {
  id: string; side: Side; speciesId: number; name: string;
  x: number; y: number; hp: number; maxHp: number; fainted: boolean;
  artworkUrl: string | null; primaryType: PokeType; secondaryType: PokeType | null;
}
export interface ArenaAttackEvent {
  attackerId: string; defenderId: string; move: string; moveType: PokeType; vfx: string;
  damage: number; effectiveness: Effectiveness; fromX: number; fromY: number; toX: number; toY: number;
}
export interface ArenaFaintEvent { pokemonId: string; side: Side; name: string; }
export interface ArenaFrame {
  tick: number;
  pokemon: ArenaPokemonState[];
  attacks: ArenaAttackEvent[];
  faints: ArenaFaintEvent[];
  koUser: number;
  koOpponent: number;
}
export interface BattleOutcome {
  winner: Side;
  koCountUser: number;
  koCountOpponent: number;
  frames: ArenaFrame[];
  obstacles: ArenaObstacle[];
  maxTicks: number;
}

const HP_SCALE = 2;
const DAMAGE_SCALE = 0.4;
const STAB_MULTIPLIER = 1.5;
const MOVE_STEP = 5;

// Physical moves (Tackle, Scratch, Close Combat...) only reach an adjacent
// target; special moves (Flamethrower, Hydro Pump...) are ranged and can be
// thrown from further out, but fall off in power the closer they get to their
// max range -- a Flamethrower at point-blank hits as hard as it should, but
// grazing the very edge of its range is weaker than landing it mid-range.
const MELEE_RANGE = 9;
const RANGED_RANGE = 24;
const RANGED_FALLOFF_START = 14;
const RANGED_FALLOFF_FLOOR = 0.6;

function moveRange(move: BrawlMove): { max: number; falloffStart: number | null } {
  return move.category === 'physical' ? { max: MELEE_RANGE, falloffStart: null } : { max: RANGED_RANGE, falloffStart: RANGED_FALLOFF_START };
}
function rangeFalloffMultiplier(move: BrawlMove, dist: number): number {
  const range = moveRange(move);
  if (range.falloffStart == null || dist <= range.falloffStart) return 1;
  const t = clamp((dist - range.falloffStart) / (range.max - range.falloffStart), 0, 1);
  return 1 - t * (1 - RANGED_FALLOFF_FLOOR);
}

// A single hit is capped at this fraction of the target's max HP so no
// species -- however lopsided the matchup -- can one-shot a full-health
// target. See the damage formula in the main loop for the rest of the curve.
const ONE_SHOT_CAP = 0.7;
// 300 ticks is also the simulation's real-time "budget": the frontend runs one
// tick every 300ms at 1x, so a full-length match is a ~90 second round, same
// ballpark as a CS2 round timer. Most matches end well before this via a wipe.
export const MAX_TICKS = 300;
const FIELD_MIN = 2;
const FIELD_MAX = 98;

// 2-3 pairs of small cover pieces, randomly placed fresh every battle instead
// of one fixed 4-piece map -- each placed piece is mirrored 180 degrees
// around the field center so neither side's routing/sightlines are
// structurally favored by the layout, and everything stays clear of both
// spawn lanes so nobody spawns boxed in. Pokemon steer around whichever
// piece blocks their path (see nextWaypoint) and can't attack through one
// (nextWaypoint's `blocked` flag makes the attacker move instead of firing).
const OBSTACLE_PAIR_COUNT_MIN = 2;
const OBSTACLE_PAIR_COUNT_MAX = 3;
const OBSTACLE_MIN_SIZE = 6;
const OBSTACLE_MAX_SIZE = 12;
const OBSTACLE_SPAWN_MARGIN_X = 22;

function rectsOverlap(a: ArenaObstacle, b: ArenaObstacle, pad = 4): boolean {
  return !(a.x2 + pad < b.x1 || b.x2 + pad < a.x1 || a.y2 + pad < b.y1 || b.y2 + pad < a.y1);
}
function mirrorObstacle(o: ArenaObstacle): ArenaObstacle {
  return { x1: 100 - o.x2, y1: 100 - o.y2, x2: 100 - o.x1, y2: 100 - o.y1 };
}
function overlapsAny(candidate: ArenaObstacle, existing: ArenaObstacle[]): boolean {
  return existing.some(o => rectsOverlap(candidate, o));
}

function generateObstacles(): ArenaObstacle[] {
  const pairCount = OBSTACLE_PAIR_COUNT_MIN + Math.floor(Math.random() * (OBSTACLE_PAIR_COUNT_MAX - OBSTACLE_PAIR_COUNT_MIN + 1));
  const placed: ArenaObstacle[] = [];
  let attempts = 0;
  while (placed.length < pairCount * 2 && attempts < 300) {
    attempts++;
    const w = OBSTACLE_MIN_SIZE + Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE);
    const h = OBSTACLE_MIN_SIZE + Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE);
    const x1 = OBSTACLE_SPAWN_MARGIN_X + Math.random() * (100 - OBSTACLE_SPAWN_MARGIN_X * 2 - w);
    const y1 = 4 + Math.random() * (92 - h);
    const candidate: ArenaObstacle = { x1, y1, x2: x1 + w, y2: y1 + h };
    const mirrored = mirrorObstacle(candidate);
    if (overlapsAny(candidate, placed) || overlapsAny(mirrored, placed) || rectsOverlap(candidate, mirrored)) continue;
    placed.push(candidate, mirrored);
  }
  return placed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFighter(species: BattleSpecies, side: Side, index: number): Fighter {
  const maxHp = Math.max(20, Math.round(species.baseHp * HP_SCALE));
  return {
    ...species, id: `${side}-${index}`, side,
    x: side === 'user' ? 12 : 88, y: 8 + index * 16.4,
    hp: maxHp, maxHp, fainted: false, moves: buildMoveset(species.primaryType, species.secondaryType),
    cooldown: 0, targetId: null, routeCorner: null, stuckTicks: 0,
  };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function cooldownTicksFor(speed: number): number {
  return clamp(Math.round(9 - speed / 25), 2, 8);
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}
function segmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
  const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy);
  const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
  const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function pointInObstacle(x: number, y: number, o: ArenaObstacle): boolean {
  return x >= o.x1 && x <= o.x2 && y >= o.y1 && y <= o.y2;
}
function segmentBlockedByObstacle(x1: number, y1: number, x2: number, y2: number, o: ArenaObstacle): boolean {
  if (pointInObstacle(x1, y1, o) || pointInObstacle(x2, y2, o)) return true;
  return (
    segmentsIntersect(x1, y1, x2, y2, o.x1, o.y1, o.x2, o.y1) ||
    segmentsIntersect(x1, y1, x2, y2, o.x2, o.y1, o.x2, o.y2) ||
    segmentsIntersect(x1, y1, x2, y2, o.x2, o.y2, o.x1, o.y2) ||
    segmentsIntersect(x1, y1, x2, y2, o.x1, o.y2, o.x1, o.y1)
  );
}
function blockingObstacle(x1: number, y1: number, x2: number, y2: number, obstacles: ArenaObstacle[]): ArenaObstacle | null {
  return obstacles.find(o => segmentBlockedByObstacle(x1, y1, x2, y2, o)) ?? null;
}
function insideAnyObstacle(x: number, y: number, obstacles: ArenaObstacle[]): boolean {
  return obstacles.some(o => pointInObstacle(x, y, o));
}

/** Nearest-total-detour corner of the blocking obstacle, padded just outside its
 * edge -- restricted to corners actually reachable in a straight line from the
 * fighter's current spot (not back through the same obstacle). Picking a corner
 * on the far side of the obstacle would make the very next step clip straight
 * through it, freezing the fighter in place forever. */
function pickBestCorner(fighter: Fighter, target: Fighter, obstacle: ArenaObstacle): Point {
  const pad = 3;
  const corners: Point[] = [
    { x: obstacle.x1 - pad, y: obstacle.y1 - pad },
    { x: obstacle.x2 + pad, y: obstacle.y1 - pad },
    { x: obstacle.x1 - pad, y: obstacle.y2 + pad },
    { x: obstacle.x2 + pad, y: obstacle.y2 + pad },
  ].map(c => ({ x: clamp(c.x, FIELD_MIN, FIELD_MAX), y: clamp(c.y, FIELD_MIN, FIELD_MAX) }));
  const reachable = corners.filter(c => !segmentBlockedByObstacle(fighter.x, fighter.y, c.x, c.y, obstacle));
  let pool = reachable.length ? reachable : corners;
  // If we're re-picking a corner (this only runs when the target is still not
  // reachable from wherever we're standing), never re-select one we're already
  // standing on -- distance-to-self is always 0, so without this a corner that
  // doesn't actually clear the obstacle's sightline gets picked forever,
  // producing a zero-movement loop the stuck-detector can't see (moveFighterToward
  // treats "arrived at waypoint" as success even when the waypoint is a no-op).
  const notCurrent = pool.filter(c => distance(fighter.x, fighter.y, c.x, c.y) > 1.5);
  if (notCurrent.length) pool = notCurrent;
  let best = pool[0], bestScore = Infinity;
  for (const c of pool) {
    const score = distance(fighter.x, fighter.y, c.x, c.y) + distance(c.x, c.y, target.x, target.y);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** Where a fighter should step toward this tick: straight at the target if the
 * path is clear, otherwise around whichever obstacle is in the way. Sticks with
 * the chosen corner until reached (rather than recomputing every tick) so a
 * fighter doesn't dither between two equally-good routes. */
function nextWaypoint(fighter: Fighter, target: Fighter, obstacles: ArenaObstacle[]): { x: number; y: number; blocked: boolean } {
  const blocker = blockingObstacle(fighter.x, fighter.y, target.x, target.y, obstacles);
  if (!blocker) { fighter.routeCorner = null; return { x: target.x, y: target.y, blocked: false }; }
  if (!fighter.routeCorner || distance(fighter.x, fighter.y, fighter.routeCorner.x, fighter.routeCorner.y) < 2.5) {
    fighter.routeCorner = pickBestCorner(fighter, target, blocker);
  }
  return { x: fighter.routeCorner.x, y: fighter.routeCorner.y, blocked: true };
}

/** Steps the fighter one tick toward (wx, wy). Three things keep this from
 * producing the "stuck in place" / "bouncing off the wall" behavior a plain
 * fixed-length step can fall into:
 *  1. Never overshoots -- steps the *remaining* distance if it's under
 *     MOVE_STEP, instead of always taking a full step and potentially
 *     landing past a route corner and into the obstacle it was routing around.
 *  2. If the direct step would land inside an obstacle, tries sliding along
 *     just the X or just the Y axis instead of freezing outright.
 *  3. If even that fails for several ticks in a row (a fighter genuinely
 *     wedged against cover), forces a fresh route and nudges it in a random
 *     open direction to break the deadlock. */
function moveFighterToward(fighter: Fighter, wx: number, wy: number, obstacles: ArenaObstacle[]): void {
  const dx = wx - fighter.x, dy = wy - fighter.y;
  const rawLen = Math.hypot(dx, dy);

  // Already (essentially) at the waypoint we were told to route to, yet still
  // being called -- meaning the caller still sees the target as unreachable
  // from here. That's a no-progress tick even though nothing looks "blocked",
  // so it counts toward stuckTicks same as a wall collision would, instead of
  // silently resetting the counter on a move that goes nowhere.
  if (rawLen >= 0.5) {
    const step = Math.min(MOVE_STEP, rawLen);
    const nx = clamp(fighter.x + (dx / rawLen) * step, FIELD_MIN, FIELD_MAX);
    const ny = clamp(fighter.y + (dy / rawLen) * step, FIELD_MIN, FIELD_MAX);

    if (!insideAnyObstacle(nx, ny, obstacles)) {
      fighter.x = nx; fighter.y = ny; fighter.stuckTicks = 0;
      return;
    }
    if (!insideAnyObstacle(nx, fighter.y, obstacles)) {
      fighter.x = nx; fighter.stuckTicks = 0;
      return;
    }
    if (!insideAnyObstacle(fighter.x, ny, obstacles)) {
      fighter.y = ny; fighter.stuckTicks = 0;
      return;
    }
  }

  fighter.stuckTicks++;
  if (fighter.stuckTicks > 4) {
    fighter.routeCorner = null;
    fighter.stuckTicks = 0;
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const ex = clamp(fighter.x + Math.cos(angle) * MOVE_STEP, FIELD_MIN, FIELD_MAX);
      const ey = clamp(fighter.y + Math.sin(angle) * MOVE_STEP, FIELD_MIN, FIELD_MAX);
      if (!insideAnyObstacle(ex, ey, obstacles)) { fighter.x = ex; fighter.y = ey; break; }
    }
  }
}

/** Prefers moves that actually deal damage; only resorts to an immune move if every option is immune.
 * `candidates` is whichever of the attacker's moves are actually in range this tick (see moveRange). */
function pickMove(attacker: Fighter, defenderTypes: (PokeType | null)[], candidates: BrawlMove[]): BrawlMove {
  const scored = candidates.map(move => {
    const mult = typeMultiplier(move.type, defenderTypes);
    const stab = move.type === attacker.primaryType || move.type === attacker.secondaryType ? STAB_MULTIPLIER : 1;
    return { move, mult, score: Math.max(0.05, move.power * mult * stab) };
  });
  const damaging = scored.filter(s => s.mult > 0);
  const pool = damaging.length ? damaging : scored;
  const total = pool.reduce((sum, s) => sum + s.score, 0);
  let roll = Math.random() * total;
  for (const s of pool) { roll -= s.score; if (roll <= 0) return s.move; }
  return pool[pool.length - 1].move;
}

function snapshot(fighter: Fighter): ArenaPokemonState {
  return {
    id: fighter.id, side: fighter.side, speciesId: fighter.speciesId, name: fighter.name,
    x: fighter.x, y: fighter.y, hp: Math.max(0, fighter.hp), maxHp: fighter.maxHp, fainted: fighter.fainted,
    artworkUrl: fighter.artworkUrl, primaryType: fighter.primaryType, secondaryType: fighter.secondaryType,
  };
}

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Runs one Local Battle as a live 6v6 arena skirmish (CS2-team-manager style):
 * both full teams spawn on opposite sides of a field scattered with small cover
 * pieces, each alive Pokemon routes around that cover toward its nearest living
 * target and can only attack once in range AND with a clear line of sight, and
 * the match runs until one side is fully wiped (or the MAX_TICKS shot-clock
 * expires, decided by whichever side is ahead on KOs/HP). Returns a tick-by-tick
 * frame log (positions + events) for the frontend to play back as a live replay.
 */
export function simulateBattle(userSpecies: BattleSpecies[], opponentSpecies: BattleSpecies[]): BattleOutcome {
  const obstacles = generateObstacles();
  const userTeam = userSpecies.map((s, i) => toFighter(s, 'user', i));
  const opponentTeam = opponentSpecies.map((s, i) => toFighter(s, 'opponent', i));
  const all = [...userTeam, ...opponentTeam];
  const byId = new Map(all.map(f => [f.id, f]));
  let koUser = 0, koOpponent = 0;

  const frames: ArenaFrame[] = [{ tick: 0, pokemon: all.map(snapshot), attacks: [], faints: [], koUser, koOpponent }];

  const bothSidesAlive = () => userTeam.some(f => !f.fainted) && opponentTeam.some(f => !f.fainted);
  for (let tick = 1; tick <= MAX_TICKS && bothSidesAlive(); tick++) {
    const attacks: ArenaAttackEvent[] = [];
    const faints: ArenaFaintEvent[] = [];

    for (const fighter of shuffled(all)) {
      if (fighter.fainted) continue;
      const enemyPool = (fighter.side === 'user' ? opponentTeam : userTeam).filter(f => !f.fainted);
      if (!enemyPool.length) continue;

      const nearestEnemy = enemyPool.reduce((closest, candidate) => (distance(fighter.x, fighter.y, candidate.x, candidate.y) < distance(fighter.x, fighter.y, closest.x, closest.y) ? candidate : closest), enemyPool[0]);
      let target = fighter.targetId ? byId.get(fighter.targetId) : undefined;
      if (!target || target.fainted) {
        target = nearestEnemy;
        fighter.targetId = target.id;
        fighter.routeCorner = null;
      } else if (nearestEnemy.id !== target.id) {
        // Re-target if a meaningfully closer enemy has shown up -- without this a
        // fighter can lock onto its first target and get stranded chasing it
        // across the whole map (through repeated obstacle detours) while ignoring
        // enemies right next to it, stalling the match out.
        const distCurrent = distance(fighter.x, fighter.y, target.x, target.y);
        const distNearest = distance(fighter.x, fighter.y, nearestEnemy.x, nearestEnemy.y);
        if (distNearest < distCurrent * 0.7) {
          target = nearestEnemy;
          fighter.targetId = target.id;
          fighter.routeCorner = null;
        }
      }

      const dist = distance(fighter.x, fighter.y, target.x, target.y);
      const waypoint = nextWaypoint(fighter, target, obstacles);
      const usableMoves = fighter.moves.filter(m => dist <= moveRange(m).max);
      if (usableMoves.length === 0 || waypoint.blocked) {
        moveFighterToward(fighter, waypoint.x, waypoint.y, obstacles);
        continue;
      }
      fighter.stuckTicks = 0;
      if (fighter.cooldown > 0) continue;

      const defenderTypes = [target.primaryType, target.secondaryType];
      const move = pickMove(fighter, defenderTypes, usableMoves);
      const mult = typeMultiplier(move.type, defenderTypes);
      const atkStat = move.category === 'physical' ? fighter.attack : fighter.spAttack;
      const defStat = move.category === 'physical' ? target.defense : target.spDefense;
      const stab = move.type === fighter.primaryType || move.type === fighter.secondaryType ? STAB_MULTIPLIER : 1;
      const variance = 0.85 + Math.random() * 0.15;

      // Bounded 0..1 attack/defense ratio (instead of a raw division) so a big
      // stat mismatch swings damage without ever exploding into a one-shot --
      // e.g. 97 attack vs 4 defense lands ~1.37x, not ~24x. overallFactor is a
      // gentler secondary nudge from each side's overall rating, so the single
      // attack-vs-defense pair isn't the *only* thing damage answers to.
      const statRatio = atkStat / Math.max(1, atkStat + defStat);
      const statMultiplier = 0.6 + statRatio * 0.8;
      const overallFactor = clamp(1 + (fighter.overall - target.overall) / 300, 0.85, 1.15);
      const falloff = rangeFalloffMultiplier(move, dist);

      let damage = 0;
      if (mult > 0) {
        const raw = move.power * DAMAGE_SCALE * statMultiplier * overallFactor * stab * mult * falloff * variance;
        damage = Math.max(1, Math.round(Math.min(raw, target.maxHp * ONE_SHOT_CAP)));
      }
      target.hp = Math.max(0, target.hp - damage);
      fighter.cooldown = cooldownTicksFor(fighter.speed);
      attacks.push({
        attackerId: fighter.id, defenderId: target.id, move: move.name, moveType: move.type, vfx: move.vfx,
        damage, effectiveness: effectivenessLabel(mult), fromX: fighter.x, fromY: fighter.y, toX: target.x, toY: target.y,
      });

      if (target.hp <= 0 && !target.fainted) {
        target.fainted = true;
        faints.push({ pokemonId: target.id, side: target.side, name: target.name });
        if (target.side === 'opponent') koUser++; else koOpponent++;
      }
    }

    for (const f of all) if (f.cooldown > 0) f.cooldown--;
    frames.push({ tick, pokemon: all.map(snapshot), attacks, faints, koUser, koOpponent });
  }

  let winner: Side;
  const userWiped = userTeam.every(f => f.fainted), opponentWiped = opponentTeam.every(f => f.fainted);
  if (opponentWiped && !userWiped) winner = 'user';
  else if (userWiped && !opponentWiped) winner = 'opponent';
  else {
    // MAX_TICKS shot-clock expired (or an extremely rare double-wipe on the same
    // tick): decide by KOs, then total remaining HP, so the match always terminates.
    const userHpTotal = userTeam.reduce((sum, f) => sum + Math.max(0, f.hp), 0);
    const opponentHpTotal = opponentTeam.reduce((sum, f) => sum + Math.max(0, f.hp), 0);
    winner = koUser !== koOpponent ? (koUser > koOpponent ? 'user' : 'opponent') : (userHpTotal >= opponentHpTotal ? 'user' : 'opponent');
  }

  return { winner, koCountUser: koUser, koCountOpponent: koOpponent, frames, obstacles, maxTicks: MAX_TICKS };
}
