import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { normalizeExport, IMPORT_ORDER, type BlinkExportRow } from './exportFormat';
import { transaction } from '../../lib/postgres';
import { groupRowsByColumns, buildBatchInsert, type BatchRow } from './batchInsert.js';

const TABLE_COLUMNS: Record<string, string[]> = { users: ['id','username','displayName','email','balance','matchedBalance','isDeleted','isBanned','firstDepositBonusPaid','referralRewardPaid','referredById','referralCode','createdAt','updatedAt','data','isBot','isAdmin','isModerator','lastLoginAt','stripeCustomerId','coinbaseCustomerId','role','avatarUrl','emailVerified','verifiedAt','verificationMethod','referralCodeUsed'], packs_catalog: ['id','name','price','isActive','quantityLimit','currentQuantity','expiresAt','data','cooldownHours','packType','imageUrl'], pack_cards: ['id','packId','name','cardName','rarity','value','estimatedValue','odds','pullChance','imageUrl','cardImageUrl','sortOrder','quantity','data'], inventory: ['id','userId','cardId','packId','battleId','value','locked','favorite','sold','createdAt','data','cardName','rarity','emoji','cardImageUrl','packName','isLocked','isFavorite'], transactions: ['id','userId','type','amount','matchedAmount','description','sourceId','createdAt','data','provider','providerId'], packs_opened: ['id','userId','packId','inventoryId','packName','cost','cardName','rarity','clientSeed','nonce','rollValue','serverSeedHash','oddsVersionHash','provablyFair','createdAt','data'], server_seeds: ['id','seed','seedHash','active','status','createdAt','revealedAt','periodStart','periodEnd','seedHashPublic'], pack_odds_versions: ['id','packId','version','hash','snapshot','contentHash','oddsJson','cardCount','createdAt'], user_nonces: ['userId','nonce','packNonce','upgradeNonce','updatedAt'], pack_cooldowns: ['userId','packId','lastOpenedAt'], admin_credentials: ['id','adminPass','data','createdAt'], upgrader_multiplier_settings: ['id','maxChance','data','updatedAt'], upgrader_spins: ['id','userId','multiplier','totalInputValue','balanceUsed','baselineTargetValue','totalTargetValue','winChance','isWin','clientSeed','nonce','rollValue','serverSeedHash','oddsVersionHash','wonCardsJson','removedCardIdsJson','provablyFair','createdAt','data'], battles: ['id','status','mode','hostUserId','hostUsername','hostAvatar','isPublic','playerCount','teamMode','packsJson','totalCost','privateCode','startedAt','endedAt','winnerUserId','winnerUsername','winnerValue','battleSeed','currentStep','createdAt','updatedAt','data'], battle_players: ['id','battleId','userId','username','avatar','isAi','aiName','teamSide','cardsJson','totalValue','isWinner','joinedAt','data'], battle_participants: ['id','battleId','userId','slot','isBot','data'], battle_results: ['id','battleId','participantId','value','round','data'], battle_pull_audits: ['id','battleId','participantId','clientSeed','nonce','rollValue','serverSeedHash','oddsVersionHash','data'], support_chats: ['id','userId','username','status','subject','lastMessage','lastMessageAt','createdAt','updatedAt','data'], support_messages: ['id','chatId','userId','senderType','message','createdAt','data'], upgrader_settings: ['id','data','updatedAt'], upgrader_history: ['id','userId','data','createdAt'], exchanger_activity: ['id','userId','data','createdAt'], cashout_requests: ['id','userId','username','confirmationNumber','status','totalValue','totalCards','cardsJson','shippingName','shippingAddress','shippingCity','shippingState','shippingZip','shippingCountry','notes','idImageUrl','fulfilledCardIds','trackingNumber','processedAt','createdAt','updatedAt','data'], cashouts: ['id','userId','amount','status','data','createdAt','updatedAt'], activity_logs: ['id','userId','type','username','action','details','metadata','valueIn','valueOut','result','createdAt'], outbound_emails: ['id','userId','recipient','subject','status','fromAddress','replyTo','data','metadata','createdAt'], wallet_transactions: ['id','userId','type','amount','balanceBefore','balanceAfter','matchedBefore','matchedAfter','sourceId','metadata','createdAt'], leaderboard_stats: ['id','username','biggestPull','packsOpened','winStreak','upgradesAttempted','updatedAt'] };
const SNAKE: Record<string, string> = {};
for (const key of Object.keys(TABLE_COLUMNS).flatMap(t => TABLE_COLUMNS[t])) SNAKE[key] = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
const JSON_FIELDS = new Set(['data','snapshot','oddsJson','details','metadata','cardsJson','wonCardsJson','removedCardIdsJson','packsJson','fulfilledCardIds']);
const INTEGER_BOOLEAN_FIELDS = new Set(['isDeleted','isBanned','firstDepositBonusPaid','referralRewardPaid','isBot','isAdmin','isModerator','emailVerified','isActive','locked','favorite','sold','isLocked','isFavorite','active','provablyFair','isWin','isPublic','isAi','isWinner']);
const PK: Record<string, string> = { user_nonces: 'user_id', pack_cooldowns: 'user_id,pack_id' };

function syntheticId(table: string, row: BlinkExportRow, index: number) {
  return `legacy_${table}_${createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 20)}_${index}`;
}

function valueFor(row: BlinkExportRow, key: string) {
  if (!(key in row)) return undefined;
  const v = row[key];
  if (v === undefined) return undefined;
  if (INTEGER_BOOLEAN_FIELDS.has(key)) {
    if (v === null) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
  }
  if (JSON_FIELDS.has(key)) return v && typeof v === 'object' ? JSON.stringify(v) : v ?? null;
  return v;
}

function withUnknownFields(table: string, row: BlinkExportRow) {
  if (!TABLE_COLUMNS[table].includes('data')) return row;
  const known = new Set(TABLE_COLUMNS[table]), extra: any = {};
  for (const [key, value] of Object.entries(row)) if (!known.has(key) && value !== undefined) extra[key] = value;
  if (!Object.keys(extra).length) return row;
  const existing = row.data && typeof row.data === 'object' ? row.data : {};
  return { ...row, data: { ...existing, ...extra } };
}

function withSafeValues(table: string, row: BlinkExportRow, index: number) {
  const out = { ...row };
  if ('id' in out && (out.id === null || out.id === undefined || out.id === '')) out.id = syntheticId(table, row, index);
  for (const key of INTEGER_BOOLEAN_FIELDS) if (key in out && out[key] === null) out[key] = 0;
  const defaults: Record<string, unknown> = { status: 'legacy', type: 'legacy', senderType: 'system', role: 'user', mode: 'legacy', name: 'Legacy', packType: 'standard', amount: 0, matchedAmount: 0, price: 0, value: 0, maxChance: 0, playerCount: 0, teamMode: 0, currentStep: 0, version: 1 };
  for (const key of ['status','type','senderType','role','mode','name','packType','amount','matchedAmount','price','value','maxChance','playerCount','teamMode','currentStep','version']) {
    if (key in out && out[key] === null) out[key] = defaults[key];
  }
  return out;
}

async function ensureParentRows(client: any, data: ReturnType<typeof normalizeExport>) {
  const users = new Map<string, any>();
  const packs = new Map<string, any>();
  const battles = new Set<string>();
  const participants = new Map<string, string>();
  const addUser = (id: unknown, sample: BlinkExportRow = {}) => { if (typeof id === 'string' && id && !users.has(id)) users.set(id, sample); };
  const addPack = (id: unknown, sample: BlinkExportRow = {}) => { if (typeof id === 'string' && id && !packs.has(id)) packs.set(id, sample); };
  for (const row of data.users ?? []) addUser(row.id, row);
  for (const row of data.packs_catalog ?? []) addPack(row.id, row);
  for (const row of data.pack_cards ?? []) addPack(row.packId, row);
  for (const row of data.pack_odds_versions ?? []) addPack(row.packId, row);
  for (const row of data.packs_opened ?? []) { addUser(row.userId, row); addPack(row.packId, row); }
  for (const row of data.pack_cooldowns ?? []) { addUser(row.userId, row); addPack(row.packId, row); }
  for (const row of data.inventory ?? []) addUser(row.userId, row);
  for (const row of data.transactions ?? []) addUser(row.userId, row);
  for (const row of data.user_nonces ?? []) addUser(row.userId, row);
  for (const row of data.wallet_transactions ?? []) addUser(row.userId, row);
  for (const row of data.upgrader_spins ?? []) addUser(row.userId, row);
  for (const row of data.battles ?? []) { addUser(row.hostUserId, row); addUser(row.winnerUserId, row); }
  for (const row of data.battle_players ?? []) { addUser(row.userId, row); if (row.battleId) battles.add(String(row.battleId)); }
  for (const row of data.battle_participants ?? []) { addUser(row.userId, row); if (row.battleId) battles.add(String(row.battleId)); if (row.id && row.battleId) participants.set(String(row.id), String(row.battleId)); }
  for (const row of data.battle_results ?? []) { if (row.battleId) battles.add(String(row.battleId)); if (row.participantId && row.battleId) participants.set(String(row.participantId), String(row.battleId)); }
  for (const row of data.battle_pull_audits ?? []) { if (row.battleId) battles.add(String(row.battleId)); if (row.participantId && row.battleId) participants.set(String(row.participantId), String(row.battleId)); }
  for (const row of data.support_chats ?? []) addUser(row.userId, row);
  for (const row of data.support_messages ?? []) addUser(row.userId, row);
  for (const row of data.upgrader_history ?? []) addUser(row.userId, row);
  for (const row of data.exchanger_activity ?? []) addUser(row.userId, row);
  for (const row of data.cashout_requests ?? []) addUser(row.userId, row);
  for (const row of data.cashouts ?? []) addUser(row.userId, row);
  for (const row of data.activity_logs ?? []) addUser(row.userId, row);
  for (const row of data.outbound_emails ?? []) addUser(row.userId, row);

  for (const [id, row] of users) await client.query(`INSERT INTO users (id, username, display_name, is_bot, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [id, row.username ?? row.aiName ?? null, row.displayName ?? row.username ?? null, row.isAi || row.isBot ? 1 : 0, '{}']);
  for (const [id, row] of packs) await client.query(`INSERT INTO packs_catalog (id, name, price, data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`, [id, row.name ?? row.packName ?? 'Legacy Pack', row.price ?? row.cost ?? 0, '{}']);
  for (const id of battles) await client.query(`INSERT INTO battles (id, status, data) VALUES ($1,'legacy','{}') ON CONFLICT (id) DO NOTHING`, [id]);
  for (const [id, battleId] of participants) await client.query(`INSERT INTO battle_participants (id, battle_id, user_id, is_bot, data) VALUES ($1,$2,NULL,0,'{}') ON CONFLICT (id) DO NOTHING`, [id, battleId]);
}

async function runBatch(client: any, table: string, columns: string[], rows: unknown[][], pk: string): Promise<{ inserted: number; skipped: number }> {
  if (!rows.length) return { inserted: 0, skipped: 0 };
  await client.query('SAVEPOINT import_batch');
  try {
    const { sql, values } = buildBatchInsert({ table, columns, rows, conflictTarget: pk });
    await client.query(sql, values);
    await client.query('RELEASE SAVEPOINT import_batch');
    return { inserted: rows.length, skipped: 0 };
  } catch (err: any) {
    await client.query('ROLLBACK TO SAVEPOINT import_batch');
    await client.query('RELEASE SAVEPOINT import_batch');
    if (rows.length === 1) {
      if (err?.code === '23505') return { inserted: 0, skipped: 1 };
      throw err;
    }
    const mid = Math.floor(rows.length / 2);
    const left = await runBatch(client, table, columns, rows.slice(0, mid), pk);
    const right = await runBatch(client, table, columns, rows.slice(mid), pk);
    return { inserted: left.inserted + right.inserted, skipped: left.skipped + right.skipped };
  }
}

async function importTableBatched(client: any, table: string, rawRows: BlinkExportRow[]) {
  const columns = TABLE_COLUMNS[table];
  if (!columns) return { inserted: 0, skipped: 0 };
  const prepared: BatchRow[] = [];
  let skipped = 0;
  for (let index = 0; index < rawRows.length; index++) {
    const rawRow = rawRows[index];
    if (table === 'server_seeds' && (rawRow.seed == null || rawRow.seedHash == null)) { skipped++; continue; }
    const row = withSafeValues(table, withUnknownFields(table, rawRow), index);
    const presentColumns = columns.filter(c => valueFor(row, c) !== undefined);
    const sqlColumns = presentColumns.map(c => SNAKE[c] ?? c);
    const values = presentColumns.map(c => valueFor(row, c));
    if (!sqlColumns.length) { skipped++; continue; }
    prepared.push({ columns: sqlColumns, values });
  }

  let inserted = 0;
  const pk = PK[table] || 'id';
  for (const group of groupRowsByColumns(prepared)) {
    const maxBatchRows = Math.max(1, Math.min(500, Math.floor(60000 / Math.max(1, group.columns.length))));
    for (let offset = 0; offset < group.rows.length; offset += maxBatchRows) {
      const result = await runBatch(client, table, group.columns, group.rows.slice(offset, offset + maxBatchRows), pk);
      inserted += result.inserted;
      skipped += result.skipped;
    }
  }
  return { inserted, skipped };
}

export async function importBlinkExport(inputPath: string, dryRun = false): Promise<{ inserted: number; skipped: number }> {
  const data = normalizeExport(JSON.parse(await readFile(inputPath, 'utf8')));
  let inserted = 0, skipped = 0;
  if (dryRun) return { inserted: IMPORT_ORDER.reduce((n, t) => n + (data[t]?.length ?? 0), 0), skipped: 0 };
  await transaction(async client => {
    console.log('Preparing legacy parent rows...');
    await ensureParentRows(client, data);
    console.log('Parent rows ready. Starting batched import...');
    for (const table of IMPORT_ORDER) {
      const rows = data[table] ?? [];
      if (!TABLE_COLUMNS[table] || !rows.length) continue;
      const result = await importTableBatched(client, table, rows);
      inserted += result.inserted;
      skipped += result.skipped;
      console.log(`${table}: processed ${rows.length}, imported ${result.inserted}, skipped ${result.skipped}`);
    }
  });
  return { inserted, skipped };
}

if (process.argv[1]?.endsWith('importBlinkExport.ts')) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: importBlinkExport <export.json> [--dry-run]');
  importBlinkExport(path, process.argv.includes('--dry-run')).then(r => console.log(JSON.stringify(r, null, 2))).catch(err => { console.error(err); process.exit(1); });
}
