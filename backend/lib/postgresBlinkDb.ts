import { query } from './postgres';

const TABLE_MAP: Record<string, string> = {
  users:'users', packsCatalog:'packs_catalog', packCards:'pack_cards', packCooldowns:'pack_cooldowns',
  inventory:'inventory', transactions:'transactions', packsOpened:'packs_opened', serverSeeds:'server_seeds',
  packOddsVersions:'pack_odds_versions', userNonces:'user_nonces', battles:'battles', battleParticipants:'battle_participants',
  battleResults:'battle_results', battlePullAudits:'battle_pull_audits', upgraderSettings:'upgrader_settings',
  upgraderHistory:'upgrader_history', exchangerActivity:'exchanger_activity', cashouts:'cashouts',
  activityLogs:'activity_logs', outboundEmails:'outbound_emails', walletTransactions:'wallet_transactions',
  leaderboardStats:'leaderboard_stats',
};

const COLUMN_MAP: Record<string, Set<string>> = {
  users:new Set(['id','username','display_name','email','balance','matched_balance','is_deleted','is_banned','first_deposit_bonus_paid','referral_reward_paid','referred_by_id','referral_code','created_at','updated_at','data','is_bot','is_admin','is_moderator','last_login_at','stripe_customer_id','coinbase_customer_id','referral_reward_amount']),
  packs_catalog:new Set(['id','name','price','is_active','quantity_limit','current_quantity','expires_at','data','cooldown_hours','pack_type','image_url']),
  pack_cards:new Set(['id','pack_id','name','card_name','rarity','value','estimated_value','odds','pull_chance','image_url','card_image_url','sort_order','quantity','data']),
  inventory:new Set(['id','user_id','card_id','pack_id','value','locked','favorite','sold','created_at','data','card_name','rarity','emoji','card_image_url','pack_name','is_locked','is_favorite']),
  transactions:new Set(['id','user_id','type','amount','matched_amount','description','source_id','created_at','data','provider','provider_id']),
  packs_opened:new Set(['id','user_id','pack_id','inventory_id','pack_name','cost','card_name','rarity','client_seed','nonce','roll_value','server_seed_hash','odds_version_hash','provably_fair','created_at','data']),
  server_seeds:new Set(['id','seed','seed_hash','active','status','created_at','revealed_at']),
  pack_odds_versions:new Set(['id','pack_id','version','hash','snapshot','content_hash','odds_json','card_count','created_at']),
  user_nonces:new Set(['user_id','nonce','updated_at']),
  battles:new Set(['id','status','mode','host_user_id','is_public','winner_user_id','created_at','updated_at','data']),
  battle_participants:new Set(['id','battle_id','user_id','slot','is_bot','data']),
  battle_results:new Set(['id','battle_id','participant_id','value','round','data']),
  battle_pull_audits:new Set(['id','battle_id','participant_id','client_seed','nonce','roll_value','server_seed_hash','odds_version_hash','data']),
  upgrader_settings:new Set(['id','data','updated_at']), upgrader_history:new Set(['id','user_id','data','created_at']),
  exchanger_activity:new Set(['id','user_id','data','created_at']),
  cashouts:new Set(['id','user_id','amount','status','data','created_at','updated_at']),
  activity_logs:new Set(['id','user_id','type','username','action','details','value_in','value_out','result','metadata','created_at']),
  outbound_emails:new Set(['id','user_id','recipient','subject','status','data','metadata','created_at']),
  wallet_transactions:new Set(['id','user_id','type','amount','balance_before','balance_after','matched_before','matched_after','source_id','metadata','created_at']),
  leaderboard_stats:new Set(['id','username','biggest_pull','packs_opened','win_streak','upgrades_attempted','updated_at']),
};

function tableName(name: string) { return TABLE_MAP[name] || camelToSnake(name); }
function camelToSnake(name: string) { return name.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`); }
function snakeToCamel(name: string) { return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function columnsFor(table: string) { return COLUMN_MAP[table] || new Set<string>(); }
function mapRow(row: any) { const out:any = {}; for (const [k,v] of Object.entries(row)) out[snakeToCamel(k)] = v; return out; }
function normalizeInput(table: string, input: Record<string, any>) {
  const known = columnsFor(table); const cols: Record<string, any> = {}; const extra: Record<string, any> = {};
  for (const [key,value] of Object.entries(input || {})) {
    const col = camelToSnake(key);
    if (known.has(col)) cols[col] = value;
    else if (key !== 'data') extra[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'data')) cols.data = input.data;
  else if (Object.keys(extra).length) cols.data = extra;
  return cols;
}

class PgTable {
  constructor(private readonly logicalName: string) {}
  private get table() { return tableName(this.logicalName); }
  async get(id: string) { const rows = await query(`SELECT * FROM ${this.table} WHERE id=$1 LIMIT 1`, [id]); return rows[0] ? mapRow(rows[0]) : null; }
  async list(options: any = {}) {
    const where = options.where || {}; const params:any[] = []; const clauses:string[] = [];
    for (const [key,value] of Object.entries(where)) {
      const col = camelToSnake(key); params.push(value); clauses.push(`${col} = $${params.length}`);
    }
    const clause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    let order = '';
    if (options.orderBy) {
      const entries = Object.entries(options.orderBy);
      if (entries.length) order = ' ORDER BY ' + entries.map(([k,v]) => `${camelToSnake(k)} ${String(v).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`).join(', ');
    }
    const limit = Number(options.limit); const offset = Number(options.offset);
    if (Number.isFinite(limit) && limit > 0) { params.push(limit); order += ` LIMIT $${params.length}`; if (Number.isFinite(offset) && offset >= 0) { params.push(offset); order += ` OFFSET $${params.length}`; } }
    const rows = await query(`SELECT * FROM ${this.table}${clause}${order}`, params); return rows.map(mapRow);
  }
  async create(input: Record<string,any>) { const cols = normalizeInput(this.table,input); const keys = Object.keys(cols); const vals = keys.map(k => cols[k]); const placeholders = keys.map((_,i)=>`$${i+1}`); const rows = await query(`INSERT INTO ${this.table} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`, vals); return mapRow(rows[0]); }
  async update(id: string, input: Record<string,any>) { const cols = normalizeInput(this.table,input); const keys = Object.keys(cols).filter(k=>k!=='id'); if (!keys.length) return this.get(id); const params = keys.map(k=>cols[k]); const sets = keys.map((k,i)=>`${k}=$${i+1}`); params.push(id); const rows = await query(`UPDATE ${this.table} SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,params); return rows[0] ? mapRow(rows[0]) : null; }
  async delete(id: string) { await query(`DELETE FROM ${this.table} WHERE id=$1`,[id]); }
  async upsert(input: Record<string,any>) {
    const rows = await this.list({where: this.logicalName === 'packCooldowns' ? {userId:input.userId,packId:input.packId} : this.logicalName === 'userNonces' ? {userId:input.userId} : {id:input.id}, limit:1});
    return rows[0] ? this.update(rows[0].id || input.id, input) : this.create(input);
  }
}

export class PostgresBlinkDb {
  private tables = new Map<string,PgTable>();
  table<T = any>(name: string): PgTable { if (!this.tables.has(name)) this.tables.set(name,new PgTable(name)); return this.tables.get(name)!; }
  get users() { return this.table('users'); }
  get packsCatalog() { return this.table('packsCatalog'); }
  get packCards() { return this.table('packCards'); }
  get packCooldowns() { return this.table('packCooldowns'); }
  get inventory() { return this.table('inventory'); }
  get transactions() { return this.table('transactions'); }
  get packsOpened() { return this.table('packsOpened'); }
  get serverSeeds() { return this.table('serverSeeds'); }
  get packOddsVersions() { return this.table('packOddsVersions'); }
  get userNonces() { return this.table('userNonces'); }
  get battles() { return this.table('battles'); }
  get battleParticipants() { return this.table('battleParticipants'); }
  get battleResults() { return this.table('battleResults'); }
  get battlePullAudits() { return this.table('battlePullAudits'); }
  get upgraderSettings() { return this.table('upgraderSettings'); }
  get upgraderHistory() { return this.table('upgraderHistory'); }
  get exchangerActivity() { return this.table('exchangerActivity'); }
  get cashouts() { return this.table('cashouts'); }
  get activityLogs() { return this.table('activityLogs'); }
  get outboundEmails() { return this.table('outboundEmails'); }
  get walletTransactions() { return this.table('walletTransactions'); }
  get leaderboardStats() { return this.table('leaderboardStats'); }
  async sql(sqlText: string, params:any[] = []) { let i=0; const sqlPg = sqlText.replace(/\?/g,()=>`$${++i}`); const result = await import('./postgres').then(m=>m.getDb().query(sqlPg,params)); return result; }
}

export const postgresBlinkDb = new PostgresBlinkDb();
