import { query } from '../lib/postgres';

export interface SiteSimulationSettings {
  packsOpenedMin: number;
  packsOpenedMax: number;
  cardsWonMin: number;
  cardsWonMax: number;
  livePlayersMin: number;
  livePlayersMax: number;
  updatedAt: string;
}

const DEFAULTS: SiteSimulationSettings = {
  packsOpenedMin: 40000, packsOpenedMax: 80000,
  cardsWonMin: 420, cardsWonMax: 10420,
  livePlayersMin: 150, livePlayersMax: 250,
  updatedAt: new Date(0).toISOString(),
};

function mapRow(row: any): SiteSimulationSettings {
  return {
    packsOpenedMin: Number(row.packs_opened_min),
    packsOpenedMax: Number(row.packs_opened_max),
    cardsWonMin: Number(row.cards_won_min),
    cardsWonMax: Number(row.cards_won_max),
    livePlayersMin: Number(row.live_players_min),
    livePlayersMax: Number(row.live_players_max),
    updatedAt: row.updated_at,
  };
}

export async function getSiteSettings(): Promise<SiteSimulationSettings> {
  const rows = await query('SELECT * FROM site_simulation_settings WHERE id=1 LIMIT 1');
  if (!rows[0]) return DEFAULTS;
  return mapRow(rows[0]);
}

const COLUMN_MAP = {
  packsOpenedMin: 'packs_opened_min',
  packsOpenedMax: 'packs_opened_max',
  cardsWonMin: 'cards_won_min',
  cardsWonMax: 'cards_won_max',
  livePlayersMin: 'live_players_min',
  livePlayersMax: 'live_players_max',
} as const;

export async function updateSiteSettings(fields: Partial<Record<keyof typeof COLUMN_MAP, number>>): Promise<SiteSimulationSettings> {
  const keys = (Object.keys(fields) as (keyof typeof COLUMN_MAP)[]).filter(k => fields[k] !== undefined);
  if (keys.length === 0) return getSiteSettings();
  const setClauses = keys.map((k, i) => `${COLUMN_MAP[k]}=$${i + 1}`);
  const values = keys.map(k => fields[k]);
  await query(
    `UPDATE site_simulation_settings SET ${setClauses.join(', ')}, updated_at=now() WHERE id=1`,
    values,
  );
  return getSiteSettings();
}
