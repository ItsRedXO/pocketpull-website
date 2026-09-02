import { query, transaction } from '../lib/postgres';
export async function recordExchange(id:string,userId:string,data:unknown){return (await query('INSERT INTO exchanger_activity(id,user_id,data) VALUES($1,$2,$3) RETURNING *',[id,userId,JSON.stringify(data)]))[0];}
export async function atomicExchange<T>(fn:(client:any)=>Promise<T>){return transaction(fn);}
