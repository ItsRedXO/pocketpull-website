import { randomUUID } from 'node:crypto';
import { getDb, type DbEnv } from '../client';

function id(prefix: string) { return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`; }

export async function createBattle(env: DbEnv, input: {
  userId: string; selectedPackIds: string[]; mode?: string; playerCount?: number;
  isPublic?: boolean; teamMode?: boolean;
}) {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(`
      SELECT id, username, display_name, avatar_url, balance, matched_balance, is_deleted, is_banned
      FROM users WHERE id=$1 FOR UPDATE`, [input.userId]);
    const user = userResult.rows[0];
    if (!user) return await rollback(client, 'User not found', 404);
    if (user.is_deleted) return await rollback(client, 'Account deactivated', 403);
    if (user.is_banned) return await rollback(client, 'Account banned', 403);

    const uniqueIds = [...new Set(input.selectedPackIds)];
    const packsResult = await client.query(`SELECT * FROM packs_catalog WHERE id=ANY($1::text[])`, [uniqueIds]);
    const byId = new Map(packsResult.rows.map(p => [p.id, p]));
    const packs: any[] = [];
    for (const packId of input.selectedPackIds) {
      const pack = byId.get(packId);
      if (!pack || !pack.is_active) return await rollback(client, `Pack ${packId} not found or inactive`, 400);
      packs.push(pack);
    }

    const totalCost = packs.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const balance = Number(user.balance || 0);
    const matched = Number(user.matched_balance || 0);
    if (totalCost > balance + matched + 0.000001) {
      return await rollback(client, `Insufficient balance. Need ${totalCost.toFixed(2)}, have ${(balance + matched).toFixed(2)}`, 400);
    }

    const playerCount = Math.min(Number(input.playerCount) || 2, 4);
    const teamBattle = Boolean(input.teamMode) && playerCount === 4;
    const battleId = id('battle');
    const username = user.username || user.display_name || 'Trainer';
    const packsJson = packs.map(p => ({ id:p.id, name:p.name, imageUrl:p.image_url, price:Number(p.price), borderColor:p.border_color, glowColor:p.glow_color }));
    const privateCode = input.isPublic ? null : id('code').slice(-6).toUpperCase();

    // Preserve the application's matched-balance-first spending rule.
    const matchedUsed = Math.min(matched, totalCost);
    const balanceUsed = totalCost - matchedUsed;
    const newMatched = matched - matchedUsed;
    const newBalance = balance - balanceUsed;

    await client.query(`
      UPDATE users SET balance=$2, matched_balance=$3, updated_at=NOW()
      WHERE id=$1`, [input.userId, newBalance, newMatched]);

    await client.query(`
      INSERT INTO battles
        (id,host_user_id,host_username,host_avatar,mode,player_count,is_public,status,packs_json,total_cost,private_code,created_at,team_mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'waiting',$8::jsonb,$9,$10,NOW(),$11)`,
      [battleId,input.userId,username,user.avatar_url||'',input.mode||'standard',playerCount,Boolean(input.isPublic),JSON.stringify(packsJson),totalCost,privateCode,teamBattle?'1':'0']);

    const playerId = id('bp');
    await client.query(`
      INSERT INTO battle_players
        (id,battle_id,user_id,username,avatar,is_ai,joined_at,cards_json,total_value,is_winner,team_side)
      VALUES ($1,$2,$3,$4,$5,FALSE,NOW(),'[]'::jsonb,0,FALSE,$6)`,
      [playerId,battleId,input.userId,username,user.avatar_url||'',teamBattle?'left':null]);

    await client.query(`
      INSERT INTO wallet_transactions
        (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at)
      VALUES ($1,$2,'battle_entry',$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())`,
      [id('wt'),input.userId,-totalCost,balance,newBalance,matched,newMatched,battleId,JSON.stringify({balanceUsed,matchedUsed})]);

    await client.query(`
      INSERT INTO transactions (id,user_id,type,amount,description,created_at)
      VALUES ($1,$2,'battle_entry',$3,$4,NOW())`,
      [id('txn'),input.userId,-totalCost,`Pack Battle entry (${packs.length} pack${packs.length > 1 ? 's' : ''})`]);

    await client.query('COMMIT');
    return { success:true, battleId, privateCode, newBalance, newMatchedBalance:newMatched };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(()=>undefined);
    return { success:false, error:error?.message || 'Internal server error', status:500 };
  } finally { client.release(); }
}

async function rollback(client:any, error:string, status:number) {
  await client.query('ROLLBACK');
  return { success:false, error, status };
}
