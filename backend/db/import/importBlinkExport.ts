import { readFile } from 'node:fs/promises';
import { normalizeExport, IMPORT_ORDER, type BlinkExportRow } from './exportFormat';
import { transaction } from '../../lib/postgres';

const TABLE_COLUMNS: Record<string, string[]> = {
  users: ['id','username','displayName','email','balance','matchedBalance','isDeleted','isBanned','firstDepositBonusPaid','referralRewardPaid','referredById','referralCode','createdAt','updatedAt','data'],
  packs_catalog: ['id','name','price','isActive','quantityLimit','currentQuantity','expiresAt','data'],
  pack_cards: ['id','packId','name','rarity','value','odds','imageUrl','data'],
  inventory: ['id','userId','cardId','packId','value','locked','favorite','sold','createdAt','data'],
  transactions: ['id','userId','type','amount','matchedAmount','description','sourceId','createdAt','data'],
  packs_opened: ['id','userId','packId','inventoryId','clientSeed','nonce','rollValue','serverSeedHash','oddsVersionHash','provablyFair','createdAt','data'],
  server_seeds: ['id','seed','seedHash','active','createdAt','revealedAt'],
  pack_odds_versions: ['id','packId','version','hash','snapshot','createdAt'],
  user_nonces: ['userId','nonce','updatedAt'],
  battles: ['id','status','mode','hostUserId','isPublic','winnerUserId','createdAt','updatedAt','data'],
  battle_participants: ['id','battleId','userId','slot','isBot','data'],
  battle_results: ['id','battleId','participantId','value','round','data'],
  battle_pull_audits: ['id','battleId','participantId','clientSeed','nonce','rollValue','serverSeedHash','oddsVersionHash','data'],
  upgrader_settings: ['id','data','updatedAt'],
  upgrader_history: ['id','userId','data','createdAt'],
  exchanger_activity: ['id','userId','data','createdAt'],
  cashouts: ['id','userId','amount','status','data','createdAt','updatedAt'],
  activity_logs: ['id','userId','type','username','action','details','valueIn','valueOut','result','createdAt'],
  outbound_emails: ['id','userId','recipient','subject','status','data','createdAt'],
};

const SNAKE: Record<string, string> = {
  displayName:'display_name', matchedBalance:'matched_balance', isDeleted:'is_deleted', isBanned:'is_banned', firstDepositBonusPaid:'first_deposit_bonus_paid', referralRewardPaid:'referral_reward_paid', referredById:'referred_by_id', referralCode:'referral_code', createdAt:'created_at', updatedAt:'updated_at',
  packId:'pack_id', isActive:'is_active', quantityLimit:'quantity_limit', currentQuantity:'current_quantity', expiresAt:'expires_at', imageUrl:'image_url', odds:'odds', userId:'user_id', cardId:'card_id', locked:'locked', favorite:'favorite', sold:'sold', matchedAmount:'matched_amount', sourceId:'source_id', clientSeed:'client_seed', inventoryId:'inventory_id', nonce:'nonce', rollValue:'roll_value', serverSeedHash:'server_seed_hash', oddsVersionHash:'odds_version_hash', provablyFair:'provably_fair', seedHash:'seed_hash', revealedAt:'revealed_at', version:'version', snapshot:'snapshot', hash:'hash', hostUserId:'host_user_id', isPublic:'is_public', winnerUserId:'winner_user_id', battleId:'battle_id', participantId:'participant_id', isBot:'is_bot', round:'round', valueIn:'value_in', valueOut:'value_out', details:'details', outboundEmail:'outbound_email',
};

function valueFor(row: BlinkExportRow, key: string) {
  if (!(key in row)) return null;
  const value = row[key];
  if (value === undefined) return null;
  if (key === 'data' && (value === null || typeof value !== 'object')) return {};
  return value;
}

export async function importBlinkExport(inputPath: string, dryRun = false): Promise<{ inserted: number; skipped: number }> {
  const raw = JSON.parse(await readFile(inputPath, 'utf8'));
  const data = normalizeExport(raw);
  let inserted = 0, skipped = 0;
  if (dryRun) return { inserted: IMPORT_ORDER.reduce((n, t) => n + (data[t]?.length ?? 0), 0), skipped: 0 };

  await transaction(async (client) => {
    for (const table of IMPORT_ORDER) {
      const rows = data[table] ?? [];
      const columns = TABLE_COLUMNS[table];
      if (!columns) continue;
      for (const row of rows) {
        const sqlColumns = columns.map(c => SNAKE[c] ?? c.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`));
        const values = columns.map(c => valueFor(row, c));
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const updates = sqlColumns.slice(1).map(c => `${c}=EXCLUDED.${c}`).join(', ');
        await client.query(`INSERT INTO ${table} (${sqlColumns.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`, values);
        inserted++;
      }
    }
  });
  return { inserted, skipped };
}

if (process.argv[1]?.endsWith('importBlinkExport.ts')) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: importBlinkExport <export.json> [--dry-run]');
  importBlinkExport(path, process.argv.includes('--dry-run')).then(r => console.log(JSON.stringify(r, null, 2))).catch(err => { console.error(err); process.exit(1); });
}
