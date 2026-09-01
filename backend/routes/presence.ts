import { Hono } from 'hono'; import { getBlinkServer } from '../lib/auth';
const app=new Hono();app.get('/presence/count',async c=>{try{const db=getBlinkServer(c.env as any).db;const r=await db.query(`SELECT COUNT(*)::int AS count FROM users WHERE is_deleted=0 AND is_banned=0`);return c.json({count:Number(r.rows[0]?.count||0)})}catch{return c.json({count:0})}});export default app;
