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

interface Fighter extends BattleSpecies {
  slot: number;
  maxHp: number;
  currentHp: number;
  moves: BrawlMove[];
}

export type BattleEvent =
  | { type: 'send_out'; side: 'user' | 'opponent'; slot: number; speciesId: number; name: string; maxHp: number; artworkUrl: string | null; primaryType: PokeType; secondaryType: PokeType | null }
  | { type: 'move'; side: 'user' | 'opponent'; attacker: string; defender: string; move: string; moveType: PokeType; vfx: string; damage: number; effectiveness: 'immune' | 'not-very-effective' | 'neutral' | 'super-effective'; defenderHpAfter: number; defenderMaxHp: number }
  | { type: 'faint'; side: 'user' | 'opponent'; name: string; koCountForOpponent: number };

export interface BattleOutcome {
  winner: 'user' | 'opponent';
  koCountUser: number;
  koCountOpponent: number;
  log: BattleEvent[];
}

const HP_SCALE = 2;
const DAMAGE_SCALE = 0.4;
const STAB_MULTIPLIER = 1.5;
const ROUNDS_TO_WIN = 3;

function toFighter(species: BattleSpecies, slot: number): Fighter {
  const maxHp = Math.max(20, Math.round(species.baseHp * HP_SCALE));
  return { ...species, slot, maxHp, currentHp: maxHp, moves: buildMoveset(species.primaryType, species.secondaryType) };
}

function pickMove(attacker: Fighter, defender: Fighter): BrawlMove {
  const defenderTypes = [defender.primaryType, defender.secondaryType];
  const scored = attacker.moves.map(move => {
    const mult = typeMultiplier(move.type, defenderTypes);
    const stab = move.type === attacker.primaryType || move.type === attacker.secondaryType ? STAB_MULTIPLIER : 1;
    return { move, score: Math.max(0.05, move.power * mult * stab) };
  });
  const total = scored.reduce((sum, s) => sum + s.score, 0);
  let roll = Math.random() * total;
  for (const s of scored) { roll -= s.score; if (roll <= 0) return s.move; }
  return scored[scored.length - 1].move;
}

function resolveAttack(attacker: Fighter, defender: Fighter, side: 'user' | 'opponent', log: BattleEvent[]) {
  const move = pickMove(attacker, defender);
  const defenderTypes = [defender.primaryType, defender.secondaryType];
  const mult = typeMultiplier(move.type, defenderTypes);
  const atkStat = move.category === 'physical' ? attacker.attack : attacker.spAttack;
  const defStat = move.category === 'physical' ? defender.defense : defender.spDefense;
  const stab = move.type === attacker.primaryType || move.type === attacker.secondaryType ? STAB_MULTIPLIER : 1;
  const variance = 0.85 + Math.random() * 0.15;
  const rawDamage = mult === 0 ? 0 : move.power * (atkStat / Math.max(1, defStat)) * stab * mult * DAMAGE_SCALE * variance;
  const damage = mult === 0 ? 0 : Math.max(1, Math.round(rawDamage));
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  log.push({
    type: 'move', side, attacker: attacker.name, defender: defender.name, move: move.name, moveType: move.type, vfx: move.vfx,
    damage, effectiveness: effectivenessLabel(mult), defenderHpAfter: defender.currentHp, defenderMaxHp: defender.maxHp,
  });
}

/**
 * Runs one Local Battle: two 6-slot teams duel one pair at a time (Stadium-style),
 * a fainted Pokemon is replaced by the next slot on its side, and the match ends
 * the instant either side has knocked out ROUNDS_TO_WIN of the other's team --
 * it does not require sweeping the full roster.
 */
export function simulateBattle(userSpecies: BattleSpecies[], opponentSpecies: BattleSpecies[]): BattleOutcome {
  const userTeam = userSpecies.map(toFighter);
  const opponentTeam = opponentSpecies.map(toFighter);
  const log: BattleEvent[] = [];
  let userIdx = 0, opponentIdx = 0, koUser = 0, koOpponent = 0;

  const sendOutEvent = (fighter: Fighter, side: 'user' | 'opponent'): BattleEvent => ({
    type: 'send_out', side, slot: fighter.slot, speciesId: fighter.speciesId, name: fighter.name, maxHp: fighter.maxHp,
    artworkUrl: fighter.artworkUrl, primaryType: fighter.primaryType, secondaryType: fighter.secondaryType,
  });
  log.push(sendOutEvent(userTeam[0], 'user'));
  log.push(sendOutEvent(opponentTeam[0], 'opponent'));

  let guard = 0;
  while (koUser < ROUNDS_TO_WIN && koOpponent < ROUNDS_TO_WIN && guard++ < 500) {
    const user = userTeam[userIdx];
    const opponent = opponentTeam[opponentIdx];
    const userFirst = user.speed === opponent.speed ? Math.random() < 0.5 : user.speed > opponent.speed;
    const order: Array<{ fighter: Fighter; opp: Fighter; side: 'user' | 'opponent' }> = userFirst
      ? [{ fighter: user, opp: opponent, side: 'user' }, { fighter: opponent, opp: user, side: 'opponent' }]
      : [{ fighter: opponent, opp: user, side: 'opponent' }, { fighter: user, opp: opponent, side: 'user' }];

    for (const turn of order) {
      if (turn.fighter.currentHp <= 0 || turn.opp.currentHp <= 0) continue;
      resolveAttack(turn.fighter, turn.opp, turn.side, log);
      if (turn.opp.currentHp <= 0) {
        const defeatedSide = turn.side === 'user' ? 'opponent' : 'user';
        if (defeatedSide === 'opponent') koUser++; else koOpponent++;
        log.push({ type: 'faint', side: defeatedSide, name: turn.opp.name, koCountForOpponent: defeatedSide === 'opponent' ? koUser : koOpponent });
        break;
      }
    }

    if (koUser >= ROUNDS_TO_WIN || koOpponent >= ROUNDS_TO_WIN) break;
    if (user.currentHp <= 0 && userIdx < userTeam.length - 1) {
      userIdx++;
      log.push(sendOutEvent(userTeam[userIdx], 'user'));
    }
    if (opponent.currentHp <= 0 && opponentIdx < opponentTeam.length - 1) {
      opponentIdx++;
      log.push(sendOutEvent(opponentTeam[opponentIdx], 'opponent'));
    }
  }

  return { winner: koUser >= ROUNDS_TO_WIN ? 'user' : 'opponent', koCountUser: koUser, koCountOpponent: koOpponent, log };
}
