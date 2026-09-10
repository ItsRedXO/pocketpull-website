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
}

const HP_SCALE = 2;
const DAMAGE_SCALE = 0.4;
const STAB_MULTIPLIER = 1.5;
const ROUNDS_TO_WIN = 3;
const ATTACK_RANGE = 16;
const MOVE_STEP = 5;
const MAX_TICKS = 160;
const FIELD_MIN = 2;
const FIELD_MAX = 98;

// Three wall segments with two gaps between them, splitting the field into lanes.
// Pokemon route around them (see nextWaypoint) and can't attack through them
// (see lineOfSightBlocked) -- no more cross-map insta-kills through solid cover.
const OBSTACLES: ArenaObstacle[] = [
  { x1: 44, y1: 0, x2: 56, y2: 27 },
  { x1: 44, y1: 41, x2: 56, y2: 59 },
  { x1: 44, y1: 73, x2: 56, y2: 100 },
];
const PASSAGES: { x: number; y: number }[] = [
  { x: 50, y: 34 },
  { x: 50, y: 66 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFighter(species: BattleSpecies, side: Side, index: number): Fighter {
  const maxHp = Math.max(20, Math.round(species.baseHp * HP_SCALE));
  return {
    ...species, id: `${side}-${index}`, side,
    x: side === 'user' ? 12 : 88, y: 8 + index * 16.4,
    hp: maxHp, maxHp, fainted: false, moves: buildMoveset(species.primaryType, species.secondaryType),
    cooldown: 0, targetId: null,
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
function lineOfSightBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
  return OBSTACLES.some(o => segmentBlockedByObstacle(x1, y1, x2, y2, o));
}
function insideAnyObstacle(x: number, y: number): boolean {
  return OBSTACLES.some(o => pointInObstacle(x, y, o));
}

/** Where a fighter should step toward this tick: straight at the target if the
 * path is clear, otherwise the nearer passage gap until it's through, so
 * movement routes around cover instead of clipping through it. */
function nextWaypoint(fighter: Fighter, target: Fighter): { x: number; y: number; blocked: boolean } {
  const blocked = lineOfSightBlocked(fighter.x, fighter.y, target.x, target.y);
  if (!blocked) return { x: target.x, y: target.y, blocked };
  const p1 = distance(fighter.x, fighter.y, PASSAGES[0].x, PASSAGES[0].y);
  const p2 = distance(fighter.x, fighter.y, PASSAGES[1].x, PASSAGES[1].y);
  const passage = p1 <= p2 ? PASSAGES[0] : PASSAGES[1];
  if (distance(fighter.x, fighter.y, passage.x, passage.y) < 3) return { x: target.x, y: target.y, blocked };
  return { x: passage.x, y: passage.y, blocked };
}

/** Prefers moves that actually deal damage; only resorts to an immune move if every option is immune. */
function pickMove(attacker: Fighter, defenderTypes: (PokeType | null)[]): BrawlMove {
  const scored = attacker.moves.map(move => {
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
 * both full teams spawn on opposite sides of a field split into lanes by cover,
 * each alive Pokemon routes around that cover toward its nearest living target
 * and can only attack once in range AND with a clear line of sight, and the
 * match ends the instant either side has scored ROUNDS_TO_WIN knockouts -- it
 * does not require wiping the opposing team. Returns a tick-by-tick frame log
 * (positions + events) for the frontend to play back as a live top-down replay.
 */
export function simulateBattle(userSpecies: BattleSpecies[], opponentSpecies: BattleSpecies[]): BattleOutcome {
  const userTeam = userSpecies.map((s, i) => toFighter(s, 'user', i));
  const opponentTeam = opponentSpecies.map((s, i) => toFighter(s, 'opponent', i));
  const all = [...userTeam, ...opponentTeam];
  const byId = new Map(all.map(f => [f.id, f]));
  let koUser = 0, koOpponent = 0;

  const frames: ArenaFrame[] = [{ tick: 0, pokemon: all.map(snapshot), attacks: [], faints: [], koUser, koOpponent }];

  for (let tick = 1; tick <= MAX_TICKS && koUser < ROUNDS_TO_WIN && koOpponent < ROUNDS_TO_WIN; tick++) {
    const attacks: ArenaAttackEvent[] = [];
    const faints: ArenaFaintEvent[] = [];

    for (const fighter of shuffled(all)) {
      if (fighter.fainted) continue;
      const enemyPool = (fighter.side === 'user' ? opponentTeam : userTeam).filter(f => !f.fainted);
      if (!enemyPool.length) continue;

      let target = fighter.targetId ? byId.get(fighter.targetId) : undefined;
      if (!target || target.fainted) {
        target = enemyPool.reduce((closest, candidate) => (distance(fighter.x, fighter.y, candidate.x, candidate.y) < distance(fighter.x, fighter.y, closest.x, closest.y) ? candidate : closest), enemyPool[0]);
        fighter.targetId = target.id;
      }

      const dist = distance(fighter.x, fighter.y, target.x, target.y);
      const waypoint = nextWaypoint(fighter, target);
      if (dist > ATTACK_RANGE || waypoint.blocked) {
        const dx = waypoint.x - fighter.x, dy = waypoint.y - fighter.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = clamp(fighter.x + (dx / len) * MOVE_STEP, FIELD_MIN, FIELD_MAX);
        const ny = clamp(fighter.y + (dy / len) * MOVE_STEP, FIELD_MIN, FIELD_MAX);
        if (!insideAnyObstacle(nx, ny)) { fighter.x = nx; fighter.y = ny; }
        continue;
      }
      if (fighter.cooldown > 0) continue;

      const defenderTypes = [target.primaryType, target.secondaryType];
      const move = pickMove(fighter, defenderTypes);
      const mult = typeMultiplier(move.type, defenderTypes);
      const atkStat = move.category === 'physical' ? fighter.attack : fighter.spAttack;
      const defStat = move.category === 'physical' ? target.defense : target.spDefense;
      const stab = move.type === fighter.primaryType || move.type === fighter.secondaryType ? STAB_MULTIPLIER : 1;
      const variance = 0.85 + Math.random() * 0.15;
      const damage = mult === 0 ? 0 : Math.max(1, Math.round(move.power * (atkStat / Math.max(1, defStat)) * stab * mult * DAMAGE_SCALE * variance));
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
  if (koUser >= ROUNDS_TO_WIN || koOpponent >= ROUNDS_TO_WIN) {
    winner = koUser >= ROUNDS_TO_WIN ? 'user' : 'opponent';
  } else {
    // MAX_TICKS safety valve (e.g. an all-immune matchup that never lands a hit):
    // decide by KOs, then total remaining HP, so the match always terminates.
    const userHpTotal = userTeam.reduce((sum, f) => sum + Math.max(0, f.hp), 0);
    const opponentHpTotal = opponentTeam.reduce((sum, f) => sum + Math.max(0, f.hp), 0);
    winner = koUser !== koOpponent ? (koUser > koOpponent ? 'user' : 'opponent') : (userHpTotal >= opponentHpTotal ? 'user' : 'opponent');
  }

  return { winner, koCountUser: koUser, koCountOpponent: koOpponent, frames, obstacles: OBSTACLES };
}
