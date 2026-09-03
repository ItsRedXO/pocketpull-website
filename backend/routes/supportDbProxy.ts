import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { query } from '../lib/postgres';

const app = new Hono();
const camelToSnake = (v:string) => v.replace(/[A-Z]/g,m=>`_${m.toLowerCase()}`);
const snakeToCamel = (v:string) => v.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const safeColumn = (v:string) => { const column=camelToSnake(v); if(!/^[a-z_][a-z0-9_]*$/.test(column)) throw new Error('Invalid database field'); return column; };
const mapRow=(row:any)=>{const out:any={};for(const [key,value] of Object.entries(row))out[snakeToCamel(key)]=value;if(row.data&&typeof row.data==='object'&&!Array.isArray(row.data))Object.assign(out,row.data);return out;};

async function identity(c:any){
  const blink=getBlinkServer(c.env as any);
  let userId:string|null=null,admin=false;
  try{const result=await blink.auth.verifyToken(c.req.header('Authorization'));if(result.valid&&result.userId)userId=result.userId;}catch{}
  const secret=c.req.header('X-Admin-Secret');
  if(secret&&secret!=='true'){
    try{const rows=await query<{admin_pass:string}>('SELECT admin_pass FROM admin_credentials WHERE admin_pass=$1 LIMIT 1',[secret]);admin=rows.length>0;}catch{}
  }
  if(!admin&&userId){try{const rows=await query<{role:string,is_admin:number}>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1',[userId]);const user=rows[0];admin=user?.role==='admin'||user?.role==='owner'||Number(user?.is_admin||0)>0;}catch{}}
  return{userId,admin};
}

app.post('/db',async(c,next)=>{
  const tableHeader=c.req.header('X-DB-Table');
  if(tableHeader!=='supportChats'&&tableHeader!=='supportMessages')return next();
  const body=await c.req.json<any>();
  if(body.table!=='supportChats'&&body.table!=='supportMessages')return next();
  try{
    const{userId,admin}=await identity(c);
    if(!userId&&!admin)return c.json({error:'UNAUTHORIZED'},401);
    const logical=body.table,table=logical==='supportChats'?'support_chats':'support_messages';
    if(body.operation==='get'){
      const rows=await query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`,[body.id]),row=rows[0];
      if(!row)return c.json({data:null});
      if(!admin){const owner=logical==='supportChats'?row.user_id:(await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1',[row.chat_id]))[0]?.user_id;if(owner!==userId)return c.json({error:'FORBIDDEN'},403);}
      return c.json({data:mapRow(row)});
    }
    if(body.operation==='list'||body.operation==='count'){
      const where={...(body.where||{})};
      if(!admin){
        if(logical==='supportChats')where.userId=userId;
        if(logical==='supportMessages'){if(!where.chatId)return c.json({error:'FORBIDDEN'},403);const owner=await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1',[where.chatId]);if(owner[0]?.user_id!==userId)return c.json({error:'FORBIDDEN'},403);}
      }
      const params:any[]=[],clauses=Object.entries(where).map(([key,value])=>{params.push(value);return `${safeColumn(key)}=$${params.length}`;}),clause=clauses.length?` WHERE ${clauses.join(' AND ')}`:'';
      if(body.operation==='count'){
        const rows=await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM ${table}${clause}`,params);
        return c.json({data:Number(rows[0]?.count||0)});
      }
      const orderEntries=Object.entries(body.orderBy||{}),order=orderEntries.length?` ORDER BY ${orderEntries.map(([key,dir])=>`${safeColumn(key)} ${String(dir).toUpperCase()==='DESC'?'DESC':'ASC'}`).join(', ')}`:'';
      params.push(Math.min(Math.max(Number(body.limit)||200,1),500));
      let sql=`SELECT * FROM ${table}${clause}${order} LIMIT $${params.length}`;
      if(body.offset!==undefined){params.push(Math.max(0,Number(body.offset)||0));sql+=` OFFSET $${params.length}`;}
      const rows=await query(sql,params);return c.json({data:rows.map(mapRow)});
    }
    if(body.operation==='create'){
      const data={...(body.data||{})};
      if(!admin){if(logical==='supportChats'&&data.userId!==userId)return c.json({error:'FORBIDDEN'},403);if(logical==='supportMessages'){if(data.userId!==userId||data.senderType!=='user')return c.json({error:'FORBIDDEN'},403);const owner=await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1',[data.chatId]);if(owner[0]?.user_id!==userId)return c.json({error:'FORBIDDEN'},403);}}
      const columns=Object.keys(data).map(safeColumn),values=Object.values(data).map(v=>v&&typeof v==='object'?JSON.stringify(v):v),placeholders=values.map((_,i)=>`$${i+1}`).join(',');
      const rows=await query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`,values);return c.json({data:mapRow(rows[0])});
    }
    if(body.operation==='update'||body.operation==='delete'){
      const rows=await query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`,[body.id]),row=rows[0];if(!row)return c.json({data:null});
      if(!admin){const owner=logical==='supportChats'?row.user_id:(await query<{user_id:string}>('SELECT user_id FROM support_chats WHERE id=$1 LIMIT 1',[row.chat_id]))[0]?.user_id;if(owner!==userId)return c.json({error:'FORBIDDEN'},403);}
      if(body.operation==='delete'){await query(`DELETE FROM ${table} WHERE id=$1`,[body.id]);return c.json({data:null});}
      const data=body.data||{},keys=Object.keys(data).filter(k=>k!=='id').map(safeColumn);if(!keys.length)return c.json({data:mapRow(row)});
      const values=Object.keys(data).filter(k=>k!=='id').map(k=>data[k]&&typeof data[k]==='object'?JSON.stringify(data[k]):data[k]),sets=keys.map((key,i)=>`${key}=$${i+1}`);values.push(body.id);
      const updated=await query(`UPDATE ${table} SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,values);return c.json({data:mapRow(updated[0])});
    }
    return c.json({error:'Unsupported database operation'},400);
  }catch(error:any){return c.json({error:error?.message||'Support database request failed'},500);}
});
export default app;
