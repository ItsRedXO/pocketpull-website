import type {
  BrawlInstance, BrawlProfileResponse, BrawlBattlePlayResult,
  BrawlMatchResult, BrawlGameResult, ArenaFrame, ArenaPokemonState, ArenaObstacle,
  BrawlConfig,
} from './brawlApi';

const ART = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

// ── 6 starter Pokémon for guest brawl roster ──────────────────────────────
export const MOCK_STARTER_ROSTER: BrawlInstance[] = [
  {
    id: 'guest-0', species_id: 25, name: 'pikachu', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 0, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'electric', secondary_type: null,
    base_hp: 35, base_attack: 55, base_defense: 40, base_sp_attack: 50, base_sp_defense: 50, base_speed: 90,
    overall_rating: 65, evolution_stage: 1, evolves_to: [26], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(25), artwork_url: ART(25),
    portrait_scale: 1.4, portrait_offset_x: 0, portrait_offset_y: 0,
  },
  {
    id: 'guest-1', species_id: 6, name: 'charizard', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 1, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'fire', secondary_type: 'flying',
    base_hp: 78, base_attack: 84, base_defense: 78, base_sp_attack: 109, base_sp_defense: 85, base_speed: 100,
    overall_rating: 78, evolution_stage: 2, evolves_to: [], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(6), artwork_url: ART(6),
    portrait_scale: 1.3, portrait_offset_x: 0, portrait_offset_y: -4,
  },
  {
    id: 'guest-2', species_id: 9, name: 'blastoise', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 2, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'water', secondary_type: null,
    base_hp: 79, base_attack: 83, base_defense: 100, base_sp_attack: 85, base_sp_defense: 105, base_speed: 78,
    overall_rating: 74, evolution_stage: 2, evolves_to: [], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(9), artwork_url: ART(9),
    portrait_scale: 1.3, portrait_offset_x: 0, portrait_offset_y: -2,
  },
  {
    id: 'guest-3', species_id: 3, name: 'venusaur', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 3, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'grass', secondary_type: 'poison',
    base_hp: 80, base_attack: 82, base_defense: 83, base_sp_attack: 100, base_sp_defense: 100, base_speed: 80,
    overall_rating: 72, evolution_stage: 2, evolves_to: [], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(3), artwork_url: ART(3),
    portrait_scale: 1.3, portrait_offset_x: 0, portrait_offset_y: 0,
  },
  {
    id: 'guest-4', species_id: 94, name: 'gengar', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 4, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'ghost', secondary_type: 'poison',
    base_hp: 60, base_attack: 65, base_defense: 60, base_sp_attack: 130, base_sp_defense: 75, base_speed: 110,
    overall_rating: 73, evolution_stage: 2, evolves_to: [], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(94), artwork_url: ART(94),
    portrait_scale: 1.4, portrait_offset_x: 0, portrait_offset_y: 0,
  },
  {
    id: 'guest-5', species_id: 448, name: 'lucario', nickname: null, source: 'starter',
    is_on_team: 1, team_slot: 5, star_level: 0, acquired_at: new Date().toISOString(),
    primary_type: 'fighting', secondary_type: 'steel',
    base_hp: 70, base_attack: 110, base_defense: 70, base_sp_attack: 115, base_sp_defense: 70, base_speed: 90,
    overall_rating: 76, evolution_stage: 1, evolves_to: [], is_legendary: 0, is_mythical: 0,
    card_tier_override: null, sprite_url: SPRITE(448), artwork_url: ART(448),
    portrait_scale: 1.4, portrait_offset_x: 0, portrait_offset_y: -2,
  },
];

// ── Fake pack open result ─────────────────────────────────────────────────
export const MOCK_PACK_OPEN_RESULT = {
  card: {
    name: "Steven's Metagross ex",
    rarity: 'god',
    value: 95,
    imageUrl: 'https://storage.googleapis.com/blink-core-storage/projects/pocketpull-premium-site-b2nnhe2n/cards/1780014540184_17_jpg/4b13f944-ec38-4132-894a-382c9991cf63.jpg' as string | null,
  },
  inventoryId: 'guest-inv-demo',
  newBalance: 100,
};

// ── Mock brawl profile response ───────────────────────────────────────────
export function getMockBrawlProfileResponse(): BrawlProfileResponse {
  return {
    profile: {
      user_id: 'guest',
      has_completed_intro: 0,
      league: 'bronze',
      league_rating: 1000,
      wins: 0, losses: 0,
      local_battles_played: 0, local_tournament_wins: 0, state_tournament_wins: 0,
      regional_tournament_wins: 0, elite_four_wins: 0,
      daily_bonus_claimed_at: null,
    },
    balance: 250,
    rosterCount: 6,
    dailyBattlesUsed: 0,
    dailyBattleCap: 10,
    tierStatus: {
      local_battle:       { unlocked: true,  cooldownEndsAt: null },
      local_tournament:   { unlocked: true,  cooldownEndsAt: null },
      state_tournament:   { unlocked: false, cooldownEndsAt: null },
      regional_tournament:{ unlocked: false, cooldownEndsAt: null },
      elite_four:         { unlocked: false, cooldownEndsAt: null },
    },
    dailyBonus: { amount: 100, claimable: false, nextClaimAt: null },
    rank: { rank: 999, total: 999 },
  };
}

// ── Mock battle arena frames ──────────────────────────────────────────────
const USER_POSITIONS   = [{ x: 18, y: 20 }, { x: 22, y: 38 }, { x: 16, y: 56 }, { x: 20, y: 70 }, { x: 24, y: 82 }, { x: 18, y: 90 }];
const OPP_POSITIONS    = [{ x: 82, y: 20 }, { x: 78, y: 38 }, { x: 84, y: 56 }, { x: 80, y: 70 }, { x: 76, y: 82 }, { x: 82, y: 90 }];
const OPP_SPECIES      = [
  { id: 143, name: 'snorlax',   type: 'normal'   as const, art: ART(143), sprite: SPRITE(143) },
  { id: 59,  name: 'arcanine',  type: 'fire'     as const, art: ART(59),  sprite: SPRITE(59)  },
  { id: 130, name: 'gyarados',  type: 'water'    as const, art: ART(130), sprite: SPRITE(130) },
  { id: 149, name: 'dragonite', type: 'dragon'   as const, art: ART(149), sprite: SPRITE(149) },
  { id: 135, name: 'jolteon',   type: 'electric' as const, art: ART(135), sprite: SPRITE(135) },
  { id: 131, name: 'lapras',    type: 'water'    as const, art: ART(131), sprite: SPRITE(131) },
];

function buildInitialPokemon(maxHp: number[]): ArenaPokemonState[] {
  const out: ArenaPokemonState[] = [];
  MOCK_STARTER_ROSTER.forEach((p, i) => {
    out.push({
      id: `u-${i}`, side: 'user', speciesId: p.species_id, name: p.name,
      x: USER_POSITIONS[i].x, y: USER_POSITIONS[i].y,
      hp: maxHp[i], maxHp: maxHp[i], fainted: false,
      artworkUrl: p.artwork_url, spriteUrl: p.sprite_url,
      primaryType: p.primary_type, secondaryType: p.secondary_type,
    });
  });
  OPP_SPECIES.forEach((p, i) => {
    out.push({
      id: `o-${i}`, side: 'opponent', speciesId: p.id, name: p.name,
      x: OPP_POSITIONS[i].x, y: OPP_POSITIONS[i].y,
      hp: maxHp[6 + i], maxHp: maxHp[6 + i], fainted: false,
      artworkUrl: p.art, spriteUrl: p.sprite,
      primaryType: p.type, secondaryType: null,
    });
  });
  return out;
}

const TYPE_MOVES: Record<string, string[]> = {
  electric: ['Thunderbolt', 'Discharge', 'Thunder'],
  fire:     ['Flamethrower', 'Fire Blast', 'Heat Wave'],
  water:    ['Hydro Pump', 'Surf', 'Scald'],
  grass:    ['Energy Ball', 'Leaf Storm', 'Petal Blizzard'],
  ghost:    ['Shadow Ball', 'Hex', 'Phantom Force'],
  fighting: ['Aura Sphere', 'Close Combat', 'Focus Blast'],
  normal:   ['Hyper Beam', 'Body Slam', 'Return'],
  dragon:   ['Draco Meteor', 'Dragon Claw', 'Outrage'],
  poison:   ['Sludge Bomb', 'Poison Jab', 'Gunk Shot'],
  flying:   ['Air Slash', 'Hurricane', 'Brave Bird'],
  steel:    ['Iron Head', 'Flash Cannon', 'Bullet Punch'],
};
const EFFECTIVENESS_POOL: Array<'neutral' | 'super-effective' | 'not-very-effective'> = [
  'neutral', 'neutral', 'neutral', 'neutral', 'super-effective', 'not-very-effective',
];

function generateBattleFrames(userWins: boolean): { frames: ArenaFrame[]; maxTicks: number } {
  const maxHps = [105, 234, 237, 240, 180, 210, 320, 212, 230, 280, 155, 220];
  const hps = [...maxHps];
  const fainted = new Array(12).fill(false);
  const frames: ArenaFrame[] = [];
  let koUser = 0, koOpponent = 0;
  const TICKS = 26;

  const getMove = (type: string) => {
    const pool = TYPE_MOVES[type] ?? ['Tackle', 'Quick Attack'];
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const randEff = () => EFFECTIVENESS_POOL[Math.floor(Math.random() * EFFECTIVENESS_POOL.length)];

  // Per-Pokemon wander phase so each game has unique idle movement
  const wanderPhase = Array.from({ length: 12 }, () => Math.random() * Math.PI * 2);

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const liveU = () => Array.from({ length: 6 }, (_, i) => i).filter(i => !fainted[i]);
  const liveO = () => Array.from({ length: 6 }, (_, i) => i).filter(i => !fainted[6 + i]);

  for (let tick = 0; tick < TICKS; tick++) {
    const alive_u = liveU();
    const alive_o = liveO();

    // Pick user attackers: always at least one, 40% chance of a second
    const uAttackers: Array<{ atk: number; tgt: number }> = [];
    if (alive_u.length > 0 && alive_o.length > 0) {
      const atk1 = pick(alive_u);
      // Focus fire: target the opponent with lowest remaining HP
      const tgt1 = alive_o.reduce((best, i) => hps[6 + i] < hps[6 + best] ? i : best, alive_o[0]);
      uAttackers.push({ atk: atk1, tgt: tgt1 });
      if (Math.random() < 0.4 && alive_u.length > 1) {
        const atk2 = pick(alive_u.filter(i => i !== atk1));
        uAttackers.push({ atk: atk2, tgt: pick(alive_o) });
      }
    }

    // Opponent attacks one random target, ~55% of ticks
    const oAttackers: Array<{ atk: number; tgt: number }> = [];
    if (alive_o.length > 0 && alive_u.length > 0 && Math.random() < 0.55) {
      oAttackers.push({ atk: pick(alive_o), tgt: pick(alive_u) });
    }

    const uAtkSet = new Set(uAttackers.map(a => a.atk));
    const oAtkSet = new Set(oAttackers.map(a => a.atk));

    // Build per-tick positions: lungers move toward their actual target; others wander
    const pokemon = buildInitialPokemon(maxHps).map((p, i) => {
      let dx = 0, dy = 0;
      const uA = p.side === 'user' ? uAttackers.find(a => a.atk === i) : undefined;
      const oA = p.side === 'opponent' ? oAttackers.find(a => a.atk === (i - 6)) : undefined;
      if (uA) {
        dx = 12;
        dy = (OPP_POSITIONS[uA.tgt].y - p.y) * 0.4;
      } else if (oA) {
        dx = -12;
        dy = (USER_POSITIONS[oA.tgt].y - p.y) * 0.4;
      } else {
        // Gentle independent wander — different phase per Pokemon, unique per game
        dx = Math.sin(tick * 0.55 + wanderPhase[i]) * 1.8;
        dy = Math.cos(tick * 0.45 + wanderPhase[i] * 1.3) * 1.4;
      }
      return { ...p, hp: Math.max(0, hps[i]), fainted: fainted[i], x: p.x + dx, y: p.y + dy };
    });

    const attacks: ArenaFrame['attacks'] = [];
    const faints: ArenaFrame['faints'] = [];

    for (const { atk, tgt } of uAttackers) {
      if (!fainted[atk] && !fainted[6 + tgt]) {
        const eff = randEff();
        const base = Math.floor(22 + Math.random() * 24);
        const dmg = eff === 'super-effective' ? Math.floor(base * 1.8) : eff === 'not-very-effective' ? Math.floor(base * 0.55) : base;
        const sp = MOCK_STARTER_ROSTER[atk];
        attacks.push({
          attackerId: `u-${atk}`, defenderId: `o-${tgt}`,
          move: getMove(sp.primary_type), moveType: sp.primary_type,
          vfx: sp.primary_type, damage: dmg, effectiveness: eff,
          fromX: USER_POSITIONS[atk].x + 12, fromY: USER_POSITIONS[atk].y,
          toX: OPP_POSITIONS[tgt].x, toY: OPP_POSITIONS[tgt].y,
        });
        hps[6 + tgt] -= dmg;
        if (hps[6 + tgt] <= 0 && !fainted[6 + tgt]) {
          fainted[6 + tgt] = true;
          faints.push({ pokemonId: `o-${tgt}`, side: 'opponent', name: OPP_SPECIES[tgt].name });
          koUser++;
        }
      }
    }

    for (const { atk, tgt } of oAttackers) {
      if (!fainted[6 + atk] && !fainted[tgt]) {
        const dmg = userWins ? Math.floor(8 + Math.random() * 12) : Math.floor(22 + Math.random() * 28);
        const op = OPP_SPECIES[atk];
        attacks.push({
          attackerId: `o-${atk}`, defenderId: `u-${tgt}`,
          move: getMove(op.type), moveType: op.type,
          vfx: op.type, damage: dmg, effectiveness: 'neutral',
          fromX: OPP_POSITIONS[atk].x - 12, fromY: OPP_POSITIONS[atk].y,
          toX: USER_POSITIONS[tgt].x, toY: USER_POSITIONS[tgt].y,
        });
        hps[tgt] -= dmg;
        if (hps[tgt] <= 0 && !fainted[tgt]) {
          fainted[tgt] = true;
          faints.push({ pokemonId: `u-${tgt}`, side: 'user', name: MOCK_STARTER_ROSTER[tgt].name });
          koOpponent++;
        }
      }
    }

    frames.push({ tick, pokemon, attacks, faints, koUser, koOpponent });
  }

  return { frames, maxTicks: TICKS };
}

const MOCK_OBSTACLES: ArenaObstacle[] = [
  { x1: 42, y1: 30, x2: 58, y2: 35 },
  { x1: 42, y1: 65, x2: 58, y2: 70 },
];

function buildGame(result: 'win' | 'loss'): BrawlGameResult {
  const { frames, maxTicks } = generateBattleFrames(result === 'win');
  return { result, frames, obstacles: MOCK_OBSTACLES, maxTicks };
}

export function getMockBattleResult(tier: string): BrawlBattlePlayResult {
  const game1 = buildGame('win');
  const game2 = buildGame('win');
  const game3 = buildGame('win');
  const match: BrawlMatchResult = {
    index: 0, result: 'win',
    opponentSpeciesIds: OPP_SPECIES.map(s => s.id),
    scoreUser: 3, scoreOpponent: 0,
    games: [game1, game2, game3],
  };
  return {
    success: true, tier, status: 'won', matchesWon: 1, matchesTotal: 1,
    reward: 50, balance: 300,
    matches: [match],
    rating: { previousRating: 1000, newRating: 1018 },
  };
}

// Mock brawl config (used to render the tier list without a real API call)
export function getMockBrawlConfig(): BrawlConfig {
  return {
    dailyBattleCap: 10,
    tierRatingDeltas: {
      local_battle:        { win: 8,  loss: -6  },
      local_tournament:    { win: 12, loss: -8  },
      state_tournament:    { win: 18, loss: -12 },
      regional_tournament: { win: 25, loss: -15 },
      elite_four:          { win: 40, loss: -20 },
    },
    battleTiers: {
      local_battle: {
        id: 'local_battle', label: 'Local Battle', description: 'A quick 1v1 match against a local trainer.',
        matches: 1, entryCost: 0, cooldownMs: 0,
        winReward: 25, lossReward: 5, totalReward: 25, lossConsolation: 5,
        opponentOverallMin: 50, opponentOverallMax: 75, strategyLevel: 0,
        unlockAfter: null,
      },
      local_tournament: {
        id: 'local_tournament', label: 'Local Tournament', description: 'Face 3 trainers in a local bracket.',
        matches: 3, entryCost: 0, cooldownMs: 0,
        winReward: 50, lossReward: 10, totalReward: 50, lossConsolation: 10,
        opponentOverallMin: 55, opponentOverallMax: 80, strategyLevel: 0,
        unlockAfter: null,
      },
      state_tournament: {
        id: 'state_tournament', label: 'State Tournament', description: 'Compete in a statewide championship.',
        matches: 5, entryCost: 50, cooldownMs: 3600000,
        winReward: 150, lossReward: 25, totalReward: 150, lossConsolation: 25,
        opponentOverallMin: 70, opponentOverallMax: 95, strategyLevel: 1,
        unlockAfter: { counter: 'local_tournament_wins', count: 3 },
      },
      regional_tournament: {
        id: 'regional_tournament', label: 'Regional Tournament', description: 'Top trainers from across the region.',
        matches: 7, entryCost: 150, cooldownMs: 7200000,
        winReward: 400, lossReward: 50, totalReward: 400, lossConsolation: 50,
        opponentOverallMin: 85, opponentOverallMax: 110, strategyLevel: 2,
        unlockAfter: { counter: 'state_tournament_wins', count: 3 },
      },
      elite_four: {
        id: 'elite_four', label: 'Elite Four', description: 'Challenge the Elite Four. Only the best survive.',
        matches: 4, entryCost: 300, cooldownMs: 14400000,
        winReward: 1000, lossReward: 75, totalReward: 1000, lossConsolation: 75,
        opponentOverallMin: 100, opponentOverallMax: 130, strategyLevel: 3,
        unlockAfter: { counter: 'regional_tournament_wins', count: 1 },
      },
    },
    safariTiers: [],
  };
}
