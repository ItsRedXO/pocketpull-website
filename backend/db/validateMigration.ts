import { query } from '../lib/postgres';

const TABLES = ['users','packs_catalog','pack_cards','inventory','transactions','packs_opened','server_seeds','pack_odds_versions','user_nonces','battles','battle_participants','battle_results','battle_pull_audits','upgrader_settings','upgrader_history','exchanger_activity','cashouts','activity_logs','outbound_emails'];

export async function validateMigration() {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = await query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  const orphanInventory = await query<{ count: string }>('SELECT count(*)::text AS count FROM inventory i LEFT JOIN users u ON u.id=i.user_id WHERE u.id IS NULL');
  const orphanCards = await query<{ count: string }>('SELECT count(*)::text AS count FROM pack_cards pc LEFT JOIN packs_catalog p ON p.id=pc.pack_id WHERE p.id IS NULL');
  const duplicateSources = await query<{ count: string }>('SELECT count(*)::text AS count FROM (SELECT source_id FROM transactions WHERE source_id IS NOT NULL GROUP BY source_id HAVING count(*) > 1) x');
  return { counts, orphanInventory: Number(orphanInventory[0]?.count ?? 0), orphanCards: Number(orphanCards[0]?.count ?? 0), duplicateSources: Number(duplicateSources[0]?.count ?? 0) };
}

if (process.argv[1]?.endsWith('validateMigration.ts')) validateMigration().then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(r.orphanInventory || r.orphanCards || r.duplicateSources ? 1 : 0); }).catch(e => { console.error(e); process.exit(1); });
