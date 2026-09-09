import { query } from '../lib/postgres';
export async function setInventoryFlag(id:string,userId:string,field:'locked'|'favorite',value:boolean){const rows=await query(`UPDATE inventory SET ${field}=$1 WHERE id=$2 AND user_id=$3 AND sold=0 RETURNING *`,[value?1:0,id,userId]);return rows[0]||null;}
