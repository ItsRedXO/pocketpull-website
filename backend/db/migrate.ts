import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb } from '../lib/postgres';
import { postgresBlinkDb } from '../lib/postgresBlinkDb';

const dir = new URL('./migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
const db=getDb();
// Surfaces RAISE NOTICE output from migration SQL in the deploy log -- lets
// a migration act as a one-shot diagnostic query against production without
// needing a separate DB console.
db.on('connect', (client) => { client.on('notice', (msg) => console.log(`[pg notice] ${msg.message}`)); });
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for(const file of files){const version=Number(file.split('_')[0]);if(!Number.isInteger(version))continue;const existing=await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);if(existing.rowCount)continue;const sql=await readFile(join(dir.pathname,file),'utf8');await db.query('BEGIN');try{await db.query(sql);await db.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[version]);await db.query('COMMIT');console.log(`Applied ${file}`);}catch(e){await db.query('ROLLBACK');throw e;}}

// TEMP: exercises the exact same postgresBlinkDb code path the admin panel's
// ReferralsSection uses (get() + list({where:{referredById}})), to isolate
// whether the referral-code display bug is in this shared abstraction layer
// versus somewhere else (dbProxy.ts auth, or the frontend). Remove once the
// referral-code bug is confirmed fixed.
try {
  const usersTable = postgresBlinkDb.table('users');
  const redxo = await usersTable.list({ where: { email: 'lopezdavid689@yahoo.com' }, limit: 1 }) as any[];
  console.log('[refdiag2] get-by-email row:', JSON.stringify(redxo[0] ? { id: redxo[0].id, referralCode: redxo[0].referralCode, email: redxo[0].email } : null));
  if (redxo[0]) {
    const direct = await usersTable.get(redxo[0].id) as any;
    console.log('[refdiag2] direct .get(id) referralCode:', JSON.stringify(direct?.referralCode));
    const referred = await usersTable.list({ where: { referredById: redxo[0].id }, orderBy: { createdAt: 'desc' }, limit: 100 }) as any[];
    console.log('[refdiag2] list({where:{referredById}}) count:', referred.length, 'sample:', JSON.stringify(referred.slice(0, 2).map(r => ({ id: r.id, email: r.email, referredById: r.referredById }))));
  }
} catch (e: any) {
  console.log('[refdiag2] ERROR:', e?.message || String(e));
}

await db.end();
