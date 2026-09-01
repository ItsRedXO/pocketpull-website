import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
const app=new Hono();
app.get('/leaderboard/:type',async c=>{const type=c.req.param('type');if(!['pulls','packs','upgrades'].includes(type))return c.json({error:'Invalid leaderboard type'},400);try{const db=getBlinkServer(c.env as any).db;const column=type==='pulls'?'biggest_pull':type==='packs'?'packs_opened':'upgrades_attempted';const r=await db.query(`SELECT username, ${column} AS numeric_value FROM leaderboard_stats WHERE is_deleted=0 ORDER BY ${column} DESC LIMIT 100`).catch(()=>({rows:[]} as any));return c.json({entries:r.rows.map((x:any)=>({username:x.username||'Trainer',numericValue:Number(x.numeric_value)||0}))});}catch{return c.json({entries:[]})}});
export default app;
