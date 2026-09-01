import { query } from '../lib/postgres';
export async function getPack(id:string){return (await query('SELECT * FROM packs_catalog WHERE id=$1',[id]))[0]||null;}
export async function getPackCards(packId:string){return query('SELECT * FROM pack_cards WHERE pack_id=$1 ORDER BY (data->>\'sortOrder\')::numeric NULLS LAST,id',[packId]);}
export async function getActiveBattlesCount(){const r=await query<{count:string}>('SELECT count(*)::text count FROM battles WHERE status IN ($1,$2) AND is_public=1',['waiting','live']);return Number(r[0]?.count||0);}
