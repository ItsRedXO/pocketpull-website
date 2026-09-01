import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../lib/auth';
const app = new Hono();
async function requireAdmin(c:any){
  const blink=getBlinkServer(c.env as any); const pass=c.req.header('X-Admin-Password');
  if(pass){const rows=await blink.db.adminCredentials.list({}); if((rows as any[]).some(r=>(r.adminPass??r.admin_pass??'')===pass)) return {db:blink.db};}
  const userId=await requireAuth(c); const user=await blink.db.users.get(userId) as any; if(!user||user.role!=='admin') throw new Error('FORBIDDEN'); return {db:blink.db};
}
app.use('/admin/packs/*',async(c,next)=>{try{await requireAdmin(c);await next();}catch(e:any){if(e.message==='FORBIDDEN')return c.json({error:'Admin access required'},403);if(e.message==='ACCOUNT_DEACTIVATED')return c.json({error:'Account deactivated'},403);return c.json({error:'Authentication required'},401);}});
app.get('/admin/packs',async c=>{try{const {db}=await requireAdmin(c);const [packs,cards]=await Promise.all([db.packsCatalog.list({orderBy:{sortOrder:'asc'}}),db.packCards.list({orderBy:{sortOrder:'asc'}})]);return c.json({packs,cards});}catch(e:any){return c.json({error:e.message||'Failed to load packs'},500);}});
app.post('/admin/packs',async c=>{try{const {db}=await requireAdmin(c);const {pack,cards=[]}=await c.req.json();if(!pack?.id||!pack?.name)return c.json({error:'Pack id and name are required'},400);await db.packsCatalog.upsert(pack);await db.packCards.deleteMany({where:{packId:pack.id}});if(cards.length)await db.packCards.createMany(cards);return c.json({success:true});}catch(e:any){console.error('[admin/packs/save]',e);return c.json({error:e.message||'Failed to save pack'},500);}});
app.patch('/admin/packs/:id',async c=>{try{const {db}=await requireAdmin(c);await db.packsCatalog.update(c.req.param('id'),await c.req.json());return c.json({success:true});}catch(e:any){return c.json({error:e.message||'Failed to update pack'},500);}});
app.delete('/admin/packs/:id',async c=>{try{const {db}=await requireAdmin(c);const id=c.req.param('id');await db.packCards.deleteMany({where:{packId:id}});await db.packsCatalog.delete(id);return c.json({success:true});}catch(e:any){return c.json({error:e.message||'Failed to delete pack'},500);}});
export default app;
