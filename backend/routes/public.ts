import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { getDb } from '../db/client';
import { listPacks, listPackCards } from '../db/repositories/packs';

const app = new Hono();

function mapPack(row:any){return {id:row.id,packType:row.pack_type==='mystery'?'mystery':'standard',name:row.name,price:Number(row.price||0),description:row.description||'',imageUrl:row.image_url||'',glowColor:row.glow_color||'',borderColor:row.border_color||'',isActive:Number(row.is_active?1:0),sortOrder:Number(row.sort_order||0),quantityLimit:Number(row.quantity_limit||0),currentQuantity:Number(row.current_quantity||0),cooldownHours:Number(row.cooldown_hours||0),expiresAt:row.expires_at||null,nameColor:row.name_color||'#ffffff',descriptionColor:row.description_color||'#ffffff',priceColor:row.price_color||'#ffffff',buttonTextColor:row.button_text_color||'#ffffff',openAnotherButtonTextColor:row.open_another_button_text_color||row.button_text_color||'#ffffff'};}
function mapCard(row:any){return {...row,id:row.id,packId:row.pack_id,cardName:row.card_name,rarity:row.rarity||'common',pullChance:Number(row.pull_chance||0),estimatedValue:Number(row.estimated_value||0),cardImageUrl:row.card_image_url||null,sortOrder:Number(row.sort_order||0),quantity:Number(row.quantity||0),originalQuantity:Number(row.original_quantity||row.quantity||0)};}

app.get('/packs', async c=>{try{const rows=await listPacks(c.env as any,true);return c.json({packs:rows.map(mapPack)});}catch(err:any){return c.json({error:err?.message||'Failed to load packs'},500);}});
app.get('/packs/:packId/cards', async c=>{try{return c.json({cards:(await listPackCards(c.env as any,c.req.param('packId'))).map(mapCard)});}catch(err:any){return c.json({error:err?.message||'Failed to load pack cards'},500);}});
app.get('/pack-cooldowns', async c=>{try{const userId=await requireAuth(c);const rows=await getDb(c.env as any).query(`SELECT pack_id,last_opened_at FROM pack_cooldowns WHERE user_id=$1`,[userId]);return c.json({cooldowns:Object.fromEntries(rows.rows.map((r:any)=>[r.pack_id,r.last_opened_at]))});}catch(err:any){return c.json({error:err?.message||'Unauthorized'},401);}});
app.get('/recent-pulls', async c=>{try{const limit=Math.min(50,Math.max(1,Number(c.req.query('limit')||12)));const rows=await getDb(c.env as any).query(`SELECT i.*,COALESCE(u.username,u.display_name,'Trainer') AS username FROM inventory i LEFT JOIN users u ON u.id=i.user_id WHERE COALESCE(u.is_deleted,FALSE)=FALSE AND COALESCE(u.is_banned,FALSE)=FALSE ORDER BY i.created_at DESC LIMIT $1`,[limit]);return c.json({pulls:rows.rows.map((r:any)=>({...r,user:r.username}))});}catch(err:any){return c.json({error:err?.message||'Failed to load recent pulls'},500);}});
app.get('/hall-of-fame', async c=>{try{const limit=Math.min(50,Math.max(1,Number(c.req.query('limit')||5)));const rows=await getDb(c.env as any).query(`SELECT i.*,COALESCE(u.username,u.display_name,'Trainer') AS username FROM inventory i LEFT JOIN users u ON u.id=i.user_id WHERE COALESCE(u.is_deleted,FALSE)=FALSE AND COALESCE(u.is_banned,FALSE)=FALSE ORDER BY i.value DESC LIMIT $1`,[limit]);return c.json({pulls:rows.rows.map((r:any)=>({...r,user:r.username}))});}catch(err:any){return c.json({error:err?.message||'Failed to load hall of fame'},500);}});

export default app;
