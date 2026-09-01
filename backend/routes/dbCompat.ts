import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { getDb } from '../db/client';
import { getUserProfile } from '../db/repositories/users';

const app=new Hono();
const TABLES:Record<string,string>={users:'users',packsCatalog:'packs_catalog',packCards:'pack_cards',packCooldowns:'pack_cooldowns',inventory:'inventory',transactions:'transactions',walletTransactions:'wallet_transactions',leaderboardStats:'leaderboard_stats',supportChats:'support_chats',supportMessages:'support_messages',cashoutRequests:'cashout_requests',outboundEmails:'outbound_emails',activityLogs:'activity_logs',upgraderMultiplierSettings:'upgrader_multiplier_settings',adminCredentials:'admin_credentials',serverSeeds:'server_seeds',packOddsVersions:'pack_odds_versions',packsOpened:'packs_opened',upgraderSpins:'upgrader_spins',exchangerTrades:'exchanger_trades',battles:'battles',battlePlayers:'battle_players'};
const PUBLIC_READ=new Set(['packsCatalog','packCards','leaderboardStats','upgraderMultiplierSettings']);
const USER_SCOPED=new Set(['inventory','transactions','walletTransactions','packCooldowns','packsOpened','upgraderSpins','exchangerTrades','supportChats','supportMessages']);
const ADMIN_ONLY=new Set(['users','cashoutRequests','outboundEmails','activityLogs','adminCredentials','serverSeeds','packOddsVersions','battles','battlePlayers']);
const snake=(s:string)=>s.replace(/[A-Z]/g,m=>`_${m.toLowerCase()}`);
const camel=(s:string)=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const toCamel=(row:any)=>Object.fromEntries(Object.entries(row).map(([k,v])=>[camel(k),v]));
const isObject=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date);

async function context(c:any){let userId:string|null=null;try{userId=await requireAuth(c);}catch{}const user=userId?await getUserProfile(c.env as any,userId):null;const isAdmin=!!user&&['admin','owner'].includes(user.role);return {userId,isAdmin};}
async function columns(table:string){const r=await getDb({} as any).query<any>(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[table]);return new Map(r.rows.map((x:any)=>[x.column_name,x.data_type]));}
function operator(value:any){if(isObject(value)){if('gte'in value)return ['>=',value.gte];if('lte'in value)return ['<=',value.lte];if('gt'in value)return ['>',value.gt];if('lt'in value)return ['<',value.lt];if('neq'in value)return ['<>',value.neq];if('in'in value)return ['IN',value.in];if('contains'in value)return ['ILIKE',`%${value.contains}%`];}return ['=',value];}
function normalize(value:any,type?:string){if(type==='boolean'&&(value===0||value===1||value==='0'||value==='1'))return Boolean(Number(value));return value;}

app.all('/compat/db/:collection/:method',async c=>{
 try{
  const collection=c.req.param('collection'),method=c.req.param('method'),table=TABLES[collection];if(!table)return c.json({error:'Collection not supported'},404);
  const ctx=await context(c);if(ADMIN_ONLY.has(collection)&&!ctx.isAdmin)return c.json({error:'Admin required'},403);if(!PUBLIC_READ.has(collection)&&!ctx.userId)return c.json({error:'Authentication required'},401);
  const body=await c.req.json().catch(()=>({}));const columnsMap=await columns(table);const allowed=(name:string)=>columnsMap.has(name);
  const inputWhere=body.where||{};const where:{sql:string;value:any}[]=[];
  for(const [rawKey,rawValue] of Object.entries(inputWhere)){const key=snake(rawKey);if(!allowed(key))continue;const [op,val]=operator(rawValue);if(op==='IN'){const arr=Array.isArray(val)?val:[];where.push({sql:`"${key}" = ANY($VALUE::text[])`,value:arr.map(x=>String(x))});}else where.push({sql:`"${key}" ${op} $VALUE`,value:normalize(val,columnsMap.get(key))});}
  if(USER_SCOPED.has(collection)&&!ctx.isAdmin){const userCol=allowed('user_id')?'user_id':allowed('userId')?'userId':null;if(userCol)where.push({sql:`"${userCol}" = $VALUE`,value:ctx.userId});}
  let values:any[]=[];const bind=(value:any)=>{values.push(value);return `$${values.length}`;};
  const clause=where.length?'WHERE '+where.map(w=>w.sql.replace('$VALUE',bind(w.value))).join(' AND '):'';
  const options=body.options||body;
  if(method==='list'){
    const orderBy=options.orderBy||{};const order=Object.entries(orderBy).map(([k,v])=>{const key=snake(k as string);if(!allowed(key))return null;const dir=String(v).toUpperCase()==='DESC'?'DESC':'ASC';return `"${key}" ${dir}`;}).filter(Boolean).join(', ')||'created_at DESC';
    const limit=Math.min(1000,Math.max(1,Number(options.limit||1000)));const offset=Math.max(0,Number(options.offset||0));const lp=bind(limit),op=bind(offset);const result=await getDb(c.env as any).query(`SELECT * FROM "${table}" ${clause} ORDER BY ${order} LIMIT ${lp} OFFSET ${op}`,values);return c.json(result.rows.map(toCamel));
  }
  if(method==='get'){
    const id=body.id||body.options?.id;if(id===undefined)return c.json(null);const idCol=allowed('id')?'id':allowed('user_id')?'user_id':null;if(!idCol)return c.json(null);const p=bind(id);const result=await getDb(c.env as any).query(`SELECT * FROM "${table}" WHERE "${idCol}"=${p} LIMIT 1`,values);return c.json(result.rows[0]?toCamel(result.rows[0]):null);
  }
  if(method==='count'){const result=await getDb(c.env as any).query<{count:string}>(`SELECT COUNT(*)::text AS count FROM "${table}" ${clause}`,values);return c.json(Number(result.rows[0]?.count||0));}
  if(method==='exists'){const result=await getDb(c.env as any).query(`SELECT 1 FROM "${table}" ${clause} LIMIT 1`,values);return c.json(result.rows.length>0);}
  if(method==='create'||method==='upsert'){
    const data=body.data||body;const pairs=Object.entries(data).filter(([k])=>allowed(snake(k)));if(!pairs.length)return c.json({error:'No writable fields'},400);const keys=pairs.map(([k])=>snake(k));const placeholders=pairs.map(([,v])=>bind(normalize(v,columnsMap.get(snake(String(pairs[pairs.findIndex(x=>x[0]===k)]?.[0]||''))))));const keySql=keys.map(k=>`"${k}"`).join(',');let sql=`INSERT INTO "${table}" (${keySql}) VALUES (${placeholders.join(',')})`;if(method==='upsert'){const conflict=keys.includes('id')?'id':collection==='upgraderMultiplierSettings'&&keys.includes('multiplier')?'multiplier':null;if(conflict)sql+=` ON CONFLICT ("${conflict}") DO UPDATE SET ${keys.filter(k=>k!==conflict).map(k=>`"${k}"=EXCLUDED."${k}"`).join(',')}`;}sql+=' RETURNING *';const result=await getDb(c.env as any).query(sql,values);return c.json(toCamel(result.rows[0]));
  }
  if(method==='update'){
    const id=body.id;const data=body.data||{};if(id===undefined)return c.json({error:'id required'},400);const pairs=Object.entries(data).filter(([k])=>allowed(snake(k)));if(!pairs.length)return c.json({error:'No writable fields'},400);const sets=pairs.map(([k,v])=>`"${snake(k)}"=${bind(normalize(v,columnsMap.get(snake(k))))}`);const ip=bind(id);const result=await getDb(c.env as any).query(`UPDATE "${table}" SET ${sets.join(',')} WHERE "id"=${ip} RETURNING *`,values);return c.json(result.rows[0]?toCamel(result.rows[0]):null);
  }
  if(method==='delete'){
    const id=body.id;if(id===undefined)return c.json({error:'id required'},400);const p=bind(id);await getDb(c.env as any).query(`DELETE FROM "${table}" WHERE "id"=${p}` ,values);return c.json({success:true});
  }
  return c.json({error:'Unsupported database method'},400);
 }catch(err:any){console.error('[db-compat]',err?.message||err);return c.json({error:err?.message||'Database operation failed'},500);}
});
export default app;
