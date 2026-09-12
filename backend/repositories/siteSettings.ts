import { query } from '../lib/postgres';

const PACIFIC_TZ = 'America/Los_Angeles';

function pacificDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Deterministic, seeded only by (metric, calendar day) -- every visitor sees
// the same number for "today", and it holds steady all day, but a *different*
// day gets a different roll instead of every day climbing to the same fixed
// ceiling.
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return function () {
    h = Math.imul(h ^ h >>> 16, 0x85ebca6b);
    h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function randomDailyTarget(metric: string, day: string, min: number, max: number): number {
  if (max <= min) return Math.round(min);
  const rng = seededRandom(`site-sim-target:${metric}:${day}`);
  return Math.round(min + rng() * (max - min));
}

export interface SiteSimulationSettings {
  packsOpenedMin: number;
  packsOpenedMax: number;
  packsOpenedTodayTarget: number;
  packsOpenedTodayOverridden: boolean;
  cardsWonMin: number;
  cardsWonMax: number;
  cardsWonTodayTarget: number;
  cardsWonTodayOverridden: boolean;
  livePlayersMin: number;
  livePlayersMax: number;
  updatedAt: string;
}

const DEFAULT_ROW = {
  packs_opened_min: 40000, packs_opened_max: 80000,
  cards_won_min: 420, cards_won_max: 10420,
  live_players_min: 150, live_players_max: 250,
  packs_opened_override_day: null, packs_opened_override_value: null,
  cards_won_override_day: null, cards_won_override_value: null,
  updated_at: new Date(0).toISOString(),
};

function mapRow(row: any): SiteSimulationSettings {
  const today = pacificDateString();
  const packsMin = Number(row.packs_opened_min);
  const packsMax = Number(row.packs_opened_max);
  const cardsMin = Number(row.cards_won_min);
  const cardsMax = Number(row.cards_won_max);

  const packsOverridden = row.packs_opened_override_day === today && row.packs_opened_override_value != null;
  const cardsOverridden = row.cards_won_override_day === today && row.cards_won_override_value != null;

  const packsTargetRaw = packsOverridden ? Number(row.packs_opened_override_value) : randomDailyTarget('packsOpened', today, packsMin, packsMax);
  const cardsTargetRaw = cardsOverridden ? Number(row.cards_won_override_value) : randomDailyTarget('cardsWon', today, cardsMin, cardsMax);

  return {
    packsOpenedMin: packsMin,
    packsOpenedMax: packsMax,
    packsOpenedTodayTarget: Math.min(packsMax, Math.max(packsMin, packsTargetRaw)),
    packsOpenedTodayOverridden: packsOverridden,
    cardsWonMin: cardsMin,
    cardsWonMax: cardsMax,
    cardsWonTodayTarget: Math.min(cardsMax, Math.max(cardsMin, cardsTargetRaw)),
    cardsWonTodayOverridden: cardsOverridden,
    livePlayersMin: Number(row.live_players_min),
    livePlayersMax: Number(row.live_players_max),
    updatedAt: row.updated_at,
  };
}

export async function getSiteSettings(): Promise<SiteSimulationSettings> {
  const rows = await query('SELECT * FROM site_simulation_settings WHERE id=1 LIMIT 1');
  return mapRow(rows[0] || DEFAULT_ROW);
}

export interface SiteSettingsUpdateInput {
  packsOpenedMin?: number;
  packsOpenedMax?: number;
  cardsWonMin?: number;
  cardsWonMax?: number;
  livePlayersMin?: number;
  livePlayersMax?: number;
  /** number pins today's Packs Opened total; null clears back to the auto daily roll. */
  packsOpenedTodayOverride?: number | null;
  /** number pins today's Cards Won total; null clears back to the auto daily roll. */
  cardsWonTodayOverride?: number | null;
}

export async function updateSiteSettings(fields: SiteSettingsUpdateInput): Promise<SiteSimulationSettings> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, val: unknown) => { values.push(val); sets.push(`${col}=$${values.length}`); };

  if (fields.packsOpenedMin !== undefined) push('packs_opened_min', fields.packsOpenedMin);
  if (fields.packsOpenedMax !== undefined) push('packs_opened_max', fields.packsOpenedMax);
  if (fields.cardsWonMin !== undefined) push('cards_won_min', fields.cardsWonMin);
  if (fields.cardsWonMax !== undefined) push('cards_won_max', fields.cardsWonMax);
  if (fields.livePlayersMin !== undefined) push('live_players_min', fields.livePlayersMin);
  if (fields.livePlayersMax !== undefined) push('live_players_max', fields.livePlayersMax);

  if (fields.packsOpenedTodayOverride !== undefined) {
    if (fields.packsOpenedTodayOverride === null) {
      push('packs_opened_override_day', null); push('packs_opened_override_value', null);
    } else {
      push('packs_opened_override_day', pacificDateString()); push('packs_opened_override_value', fields.packsOpenedTodayOverride);
    }
  }
  if (fields.cardsWonTodayOverride !== undefined) {
    if (fields.cardsWonTodayOverride === null) {
      push('cards_won_override_day', null); push('cards_won_override_value', null);
    } else {
      push('cards_won_override_day', pacificDateString()); push('cards_won_override_value', fields.cardsWonTodayOverride);
    }
  }

  if (sets.length === 0) return getSiteSettings();
  await query(`UPDATE site_simulation_settings SET ${sets.join(', ')}, updated_at=now() WHERE id=1`, values);
  return getSiteSettings();
}
