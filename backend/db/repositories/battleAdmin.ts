import { getDb, type DbEnv } from '../client';

export async function cancelBattle(env: DbEnv, battleId: string, adminUserId: string) {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const admin = await client.query<any>('SELECT role FROM users WHERE id=$1 FOR UPDATE', [adminUserId]);
    if (!['admin','owner'].includes(admin.rows[0]?.role)) throw new Error('Admin access required');
    const battleResult = await client.query<any>('SELECT * FROM battles WHERE id=$1 FOR UPDATE', [battleId]);
    const battle = battleResult.rows[0];
    if (!battle) throw new Error('Battle not found');
    if (['finished','canceled'].includes(battle.status)) throw new Error('Battle is already finished or canceled');
    const players = await client.query<any>('SELECT user_id,is_ai FROM battle_players WHERE battle_id=$1', [battleId]);
    const humans = players.rows.filter((p: any) => !Boolean(p.is_ai));
    const refunds: Array<{ userId: string; amount: number; matchedAmount: number }> = [];
    for (const player of humans) {
      const ledger = await client.query<any>('SELECT matched_before,matched_after FROM wallet_transactions WHERE id=$1 LIMIT 1', [`wt_battle_entry_${player.user_id}_${battleId}`]);
      const matchedAmount = ledger.rows[0] ? Math.max(0, Number(ledger.rows[0].matched_before) - Number(ledger.rows[0].matched_after)) : 0;
      const amount = Number(battle.total_cost || 0);
      const user = await client.query<any>('SELECT balance,matched_balance FROM users WHERE id=$1 FOR UPDATE', [player.user_id]);
      if (!user.rows[0]) continue;
      const before = user.rows[0];
      const afterBalance = Number(before.balance || 0) + amount;
      const afterMatched = Number(before.matched_balance || 0) + matchedAmount;
      const ledgerId = `wt_battle_cancel_refund_${player.user_id}_${battleId}`;
      const exists = await client.query('SELECT 1 FROM wallet_transactions WHERE id=$1', [ledgerId]);
      if (!exists.rows.length) {
        await client.query('UPDATE users SET balance=$2,matched_balance=$3,updated_at=NOW() WHERE id=$1', [player.user_id, afterBalance, afterMatched]);
        await client.query(`INSERT INTO wallet_transactions (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at) VALUES ($1,$2,'battle_entry_refund',$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())`, [ledgerId, player.user_id, amount, Number(before.balance || 0), afterBalance, Number(before.matched_balance || 0), afterMatched, battleId, JSON.stringify({ canceledBy: adminUserId })]);
        await client.query(`INSERT INTO transactions (id,user_id,type,amount,description,created_at) VALUES ($1,$2,'refund',$3,$4,NOW()) ON CONFLICT (id) DO NOTHING`, [`txn_battle_refund_${player.user_id}_${battleId}`, player.user_id, amount, `Admin refund: Battle ${battleId} canceled`]);
      }
      refunds.push({ userId: player.user_id, amount, matchedAmount });
    }
    await client.query("UPDATE battles SET status='canceled',ended_at=NOW() WHERE id=$1", [battleId]);
    await client.query('COMMIT');
    return { refundedPlayers: refunds.length, totalRefunded: refunds.reduce((sum, r) => sum + r.amount, 0) };
  } catch (err) { await client.query('ROLLBACK').catch(() => undefined); throw err; }
  finally { client.release(); }
}
