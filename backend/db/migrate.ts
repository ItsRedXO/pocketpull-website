import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb } from '../lib/postgres';

const dir = new URL('./migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
const db=getDb();
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for(const file of files){const version=Number(file.split('_')[0]);if(!Number.isInteger(version))continue;const existing=await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);if(existing.rowCount)continue;const sql=await readFile(join(dir.pathname,file),'utf8');await db.query('BEGIN');try{await db.query(sql);await db.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[version]);await db.query('COMMIT');console.log(`Applied ${file}`);}catch(e){await db.query('ROLLBACK');throw e;}}
await db.end();
