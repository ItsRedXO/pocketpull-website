import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { normalizeDatabaseConfig } from '../backend/lib/db.ts';
const root = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(root, '../backend/migrations');
async function main() { const config = normalizeDatabaseConfig(process.env); const pool = new Pool({ connectionString: config.connectionString, ssl: config.ssl ? { rejectUnauthorized: false } : undefined }); try { await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`); const files = (await readdir(migrationsDir)).filter(file => /^\d+_.+\.sql$/.test(file)).sort(); for (const file of files) { const version = file.replace(/\.sql$/, ''); const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]); if (existing.rowCount) { console.log(`[migration] skip ${version}`); continue; } const sql = await readFile(path.join(migrationsDir, file), 'utf8'); const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(sql); await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]); await client.query('COMMIT'); console.log(`[migration] applied ${version}`); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } } } finally { await pool.end(); } }
main().catch(error => { console.error('[migration] failed:', error?.message || error); process.exitCode = 1; });
