import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../../lib/auth';
import { getBattleLobby, getBattleState } from '../../db/repositories/battles';
import { AI_NAMES } from './utils';
import { processWalletTransaction } from '../../lib/wallet';

const app = new Hono();

app.get('/lobby', async (c) => {
  const userId = c.req.query('userId');
  try {
    const data = await getBattleLobby(c.env as any, userId || null);
    return c.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[battles/lobby] postgres error:', err.message);
    return c.json({ error: 'Failed to fetch lobby data' }, 500);
  }
});

app.get('/state', async (c) => {
  try { await requireAuth(c); } catch { return c.json({ error: 'Authentication required' }, 401); }
  const battleId = c.req.query('battleId');
  if (!battleId) return c.json({ error: 'battleId required' }, 400);
  try {
    const data = await getBattleState(c.env as any, battleId);
    if (!data) return c.json({ error: 'Battle not found' }, 404);
    return c.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[battles/state] postgres error:', err.message);
    return c.json({ error: 'Failed to fetch battle state' }, 500);
  }
});

// Battle creation remains Blink-backed until its atomic PostgreSQL wallet/battle transaction is migrated.
app.post('/create', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); }
  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json();
    const { selectedPackIds, mode, playerCount, isPublic, teamMode } = body;
    if (!Array.isArray(selectedPackIds) || selectedPackIds.length === 0) return c.json({ error: 'selectedPackIds required' }, 400);
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    const currentBalance = Number(user.balance || 0), currentMatchedBalance = Number(user.matchedBalance || user.matched_balance || 0);
    const uniquePackIds = [...new Set(selectedPackIds)] as string[];
    const fetchedPacks = await blink.db.packsCatalog.list({ where: { id: { in: uniquePackIds } }, limit: uniquePackIds.length }) as any[];
    const packById = new Map(fetchedPacks.map((pack: any) => [pack.id, pack]));
    const packs: any[] = [];
    for (const pid of selectedPackIds) { const p = packById.get(pid); if (!p || !Number(p.isActive)) return c.json({ error: `Pack ${pid} not found or inactive` }, 400); packs.push(p); }
    const totalCost = packs.reduce((s: number, p: any) => s + Number(p.price), 0);
    if (totalCost > currentBalance + currentMatchedBalance) return c.json({ error: `Insufficient balance. Need ${totalCost.toFixed(2)}, have ${(currentBalance + currentMatchedBalance).toFixed(2)}` }, 400);
    const effectivePlayerCount = Math.min(Number(playerCount) || 2, 4), isTeamBattle = Boolean(teamMode) && effectivePlayerCount === 4;
    const battleId = `battle_${uid()}`, username = user.username || user.displayName || 'Trainer', avatar = user.avatarUrl || '';
    const packsJson = JSON.stringify(packs.map((p: any) => ({ id:p.id,name:p.name,imageUrl:p.imageUrl,price:Number(p.price),borderColor:p.borderColor,glowColor:p.glowColor })));
    const privateCode = !isPublic ? uid().slice(0,6).toUpperCase() : null;
    await blink.db.battles.create({ id:battleId,hostUserId:userId,hostUsername:username,hostAvatar:avatar,mode:mode||'standard',playerCount:effectivePlayerCount,teamMode:isTeamBattle?1:0,isPublic:isPublic?1:0,status:'waiting',packsJson,totalCost,privateCode });
    await blink.db.battlePlayers.create({ id:`bp_${uid()}`,battleId,userId,username,avatar,isAi:0,teamSide:isTeamBattle?'left':null,cardsJson:'[]',totalValue:0,isWinner:0 });
    const walletResult = await processWalletTransaction(blink,{userId,type:'battle_entry',amount:-totalCost,matchedAmount:totalCost,sourceId:battleId});
    if (!walletResult.success) return c.json({ error:walletResult.error||'Failed to deduct balance' },500);
    await blink.db.transactions.create({ id:`txn_${uid()}`,userId,type:'battle_entry',amount:-totalCost,description:`Pack Battle entry (${packs.length} pack${packs.length>1?'s':''})` });
    return c.json({ success:true,battleId,privateCode,newBalance:walletResult.balanceAfter });
  } catch (err:any) { console.error('[battles/create] error:',err.message); return c.json({ error:err.message||'Internal server error' },500); }
});

export default app;
