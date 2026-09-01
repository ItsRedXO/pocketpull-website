export type BlinkExportRow = Record<string, unknown>;
export type BlinkExport = Record<string, BlinkExportRow[]>;

export const IMPORT_ORDER = [
  'users','packs_catalog','pack_cards','server_seeds','pack_odds_versions','user_nonces','pack_cooldowns',
  'admin_credentials','battles','battle_players','battle_participants','battle_results','battle_pull_audits',
  'inventory','transactions','packs_opened','wallet_transactions','upgrader_settings','upgrader_history',
  'exchanger_activity','cashouts','activity_logs','outbound_emails','leaderboard_stats',
] as const;

export function normalizeExport(value: unknown): BlinkExport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Export must be an object keyed by table name');
  const input = value as Record<string, unknown>;
  const output: BlinkExport = {};
  for (const table of IMPORT_ORDER) {
    const rows = input[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`Export table ${table} must be an array`);
    output[table] = rows.filter((row): row is BlinkExportRow => !!row && typeof row === 'object' && !Array.isArray(row));
  }
  return output;
}
