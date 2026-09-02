import { query, transaction } from '../lib/postgres';
export async function getCashout(id:string){return (await query('SELECT * FROM cashouts WHERE id=$1',[id]))[0]||null;}
export async function listCashouts(status?:string){return status?query('SELECT * FROM cashouts WHERE status=$1 ORDER BY created_at DESC',[status]):query('SELECT * FROM cashouts ORDER BY created_at DESC');}
export async function createCashout(input:{id:string;userId:string;amount:number;status?:string;data?:unknown}){return (await query('INSERT INTO cashouts(id,user_id,amount,status,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING *',[input.id,input.userId,input.amount,input.status||'pending',JSON.stringify(input.data||{})]))[0]||null;}
export async function transitionCashout(id:string,from:string,to:string){return transaction(async client=>(await client.query('UPDATE cashouts SET status=$1,updated_at=now() WHERE id=$2 AND status=$3 RETURNING *',[to,id,from])).rows[0]||null);}
