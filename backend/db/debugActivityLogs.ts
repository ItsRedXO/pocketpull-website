// One-off diagnostic: why does the admin Activity & History filter show
// nothing for types whose summary tiles show real numbers? Run via
// `npm run db:debug-activity` (temporary preDeployCommand), then delete
// this file and its package.json script once the mismatch is understood.
import { query } from '../lib/postgres';

const users = await query<{ id: string; username: string; email: string }>(
  `SELECT id, username, email FROM users WHERE username = 'ItsRedXO' OR email = 'lopezdavid689@yahoo.com' LIMIT 5`,
);
console.log('[debug] users:', JSON.stringify(users));
const uid = users[0]?.id;
if (uid) {
  const byType = await query(`SELECT type, count(*)::int FROM activity_logs WHERE user_id=$1 GROUP BY type ORDER BY count(*) DESC`, [uid]);
  console.log('[debug] activity_logs by type for user:', JSON.stringify(byType));
  const packs = await query(`SELECT count(*)::int FROM packs_opened WHERE user_id=$1`, [uid]);
  console.log('[debug] packs_opened count:', JSON.stringify(packs));
  const sells = await query(`SELECT count(*)::int FROM transactions WHERE user_id=$1 AND type='sell'`, [uid]);
  console.log('[debug] sell transactions count:', JSON.stringify(sells));
}
const total = await query(`SELECT count(*)::int FROM activity_logs`);
console.log('[debug] total activity_logs rows:', JSON.stringify(total));
const range = await query(`SELECT min(created_at), max(created_at) FROM activity_logs`);
console.log('[debug] activity_logs date range:', JSON.stringify(range));
const recent = await query(`SELECT id, user_id, type, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10`);
console.log('[debug] recent activity_logs rows:', JSON.stringify(recent));
process.exit(0);
