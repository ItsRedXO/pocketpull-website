import { query, type DbEnv } from '../client';

function mapBattle(row: any) {
  return { ...row, isPublic: Boolean(row.is_public), totalCost: Number(row.total_cost || 0), playerCount: Number(row.player_count || 0), teamMode: row.team_mode === true || row.team_mode === 'true' || row.team_mode === '1' || Number(row.team_mode || 0) > 0, packsJson: row.packs_json };
}

function mapPlayer(row: any) {
  return { ...row, battleId: row.battle_id, userId: row.user_id, isAi: Boolean(row.is_ai), totalValue: Number(row.total_value || 0), isWinner: Boolean(row.is_winner), teamSide: row.team_side || null, cardsJson: row.cards_json };
}

export async function countLivePublicBattles(env: DbEnv): Promise<number> {
  const result = await query<{ count: string }>(env, `SELECT COUNT(*)::text AS count FROM battles WHERE status IN ('waiting','live') AND is_public = TRUE`);
  return Number(result.rows[0]?.count || 0);
}

export async function getBattleLobby(env: DbEnv, userId?: string | null) {
  const [waiting, live, finished] = await Promise.all([
    query(env, `SELECT * FROM battles WHERE status='waiting' AND is_public=TRUE ORDER BY created_at DESC LIMIT 50`),
    query(env, `SELECT * FROM battles WHERE status='live' AND is_public=TRUE ORDER BY started_at DESC LIMIT 20`),
    query(env, `SELECT * FROM battles WHERE status='finished' AND ended_at >= date_trunc('day', NOW()) ORDER BY ended_at DESC LIMIT 50`),
  ]);

  let mine: any[] = [];
  if (userId) {
    const mineResult = await query(env, `SELECT b.* FROM battles b JOIN battle_players bp ON bp.battle_id=b.id WHERE bp.user_id=$1 ORDER BY bp.joined_at DESC LIMIT 30`, [userId]);
    mine = mineResult.rows;
  }

  const ids = [...new Set([...waiting.rows, ...live.rows, ...finished.rows, ...mine].map((b: any) => b.id))];
  let players: any[] = [];
  if (ids.length) {
    const playerResult = await query(env, `SELECT * FROM battle_players WHERE battle_id = ANY($1::text[])`, [ids]);
    players = playerResult.rows;
  }
  const attach = (rows: any[]) => rows.map(row => ({ ...mapBattle(row), players: players.filter(p => p.battle_id === row.id).map(mapPlayer) }));
  return { live: attach([...waiting.rows, ...live.rows]), daily: attach(finished.rows), mine: attach(mine), timestamp: new Date().toISOString() };
}

export async function getBattleState(env: DbEnv, battleId: string) {
  const battleResult = await query(env, `SELECT * FROM battles WHERE id=$1 LIMIT 1`, [battleId]);
  const battle = battleResult.rows[0];
  if (!battle) return null;
  const playersResult = await query(env, `SELECT * FROM battle_players WHERE battle_id=$1 ORDER BY joined_at ASC`, [battleId]);
  const packs = Array.isArray(battle.packs_json) ? battle.packs_json : [];
  const packIds = packs.map((p: any) => p?.id).filter(Boolean);
  const cardsResult = packIds.length ? await query(env, `SELECT * FROM pack_cards WHERE pack_id=ANY($1::text[])`, [packIds]) : { rows: [] as any[] };
  return { battle: mapBattle(battle), players: playersResult.rows.map(mapPlayer), packCards: cardsResult.rows };
}
