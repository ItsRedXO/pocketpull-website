import { query, transaction } from '../lib/postgres';
export async function getUpgraderSettings(){return (await query('SELECT * FROM upgrader_settings ORDER BY updated_at DESC LIMIT 1'))[0]||null;}
export async function saveUpgraderSettings(id:string,data:unknown){return (await query('INSERT INTO upgrader_settings(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now() RETURNING *',[id,JSON.stringify(data)]))[0];}
export async function recordUpgrade(id:string,userId:string,data:unknown){return (await query('INSERT INTO upgrader_history(id,user_id,data) VALUES($1,$2,$3) RETURNING *',[id,userId,JSON.stringify(data)]))[0];}
export async function atomicUpgrade<T>(fn:(client:any)=>Promise<T>){return transaction(fn);}
