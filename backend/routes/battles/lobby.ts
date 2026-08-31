import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../../lib/auth';
import { AI_NAMES } from './utils';
import { processWalletTransaction } from '../../lib/wallet';

const app = new Hono();

/**
 * GET /battles/lobby
 * Optimized endpoint to fetch all data needed for the battle board in one request.
 */
app.get('/lobby', async (c) => {
  const blink = getBlinkServer(c.env as any);
  const userId = c.req.query('userId');

  try {
    // 1. Fetch Active Battles (waiting + live, PUBLIC)
    const [waitingRaw, liveRaw] = await Promise.all([
      blink.db.battles.list({ 
        where: { status: 'waiting', isPublic: 1 }, 
        orderBy: { createdAt: 'desc' }, 
        limit: 50 
      }) as Promise<any[]>,
      blink.db.battles.list({ 
        where: { status: 'live', isPublic: 1 }, 
        orderBy: { startedAt: 'desc' }, 
        limit: 20 
      }) as Promise<any[]>,
    ]);

    // 2. Fetch Daily Finished (Today's finished)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const finishedRaw = await blink.db.battles.list({
      where: { status: 'finished' },
      orderBy: { endedAt: 'desc' },
      limit: 50,
    }) as any[];
    
    // 3. User battles if logged in
    let myBattlesRaw: any[] = [];
    if (userId) {
      const myPlayerRows = await blink.db.battlePlayers.list({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        limit: 30,
      }) as any[];
      
      if (myPlayerRows.length > 0) {
        const myBattleIds = [...new Set(myPlayerRows.map((r: any) => r.battleId))] as string[];
        // Fetch all user's battles in a single batch query
        myBattlesRaw = await blink.db.battles.list({
          where: { id: { in: myBattleIds } },
          limit: 100,
        }) as any[];
        // Sort to match the player join order for consistent UI
        const battleMap = Object.fromEntries(myBattlesRaw.map((b: any) => [b.id, b]));
        myBattlesRaw = myBattleIds.map(id => battleMap[id]).filter(Boolean);
      }
    }

    // 4. Batch fetch players for ALL battles above to avoid N+1 queries
    const allBattles = [...waitingRaw, ...liveRaw, ...finishedRaw, ...myBattlesRaw];
    const allBattleIds = [...new Set(allBattles.map(b => b.id))];
    
    let allPlayers: any[] = [];
    if (allBattleIds.length > 0) {
      // Fetch all players for all relevant battles in one go
      allPlayers = await blink.db.battlePlayers.list({
        where: { battleId: { in: allBattleIds } },
        limit: 1000
      }) as any[];
    }

    // Helper to attach players to a list of battles
    const attachPlayers = (battles: any[]) => {
      return battles.map(b => ({
        ...b,
        isPublic: Number(b.isPublic) > 0,
        totalCost: Number(b.totalCost),
        playerCount: Number(b.playerCount),
        teamMode: Number(b.teamMode || b.team_mode) > 0,
        players: allPlayers
          .filter(p => p.battleId === b.id)
          .map(p => ({
            ...p,
            isAi: Number(p.isAi) > 0,
            totalValue: Number(p.totalValue),
            isWinner: Number(p.isWinner) > 0,
            teamSide: p.teamSide || p.team_side || null,
          }))
      }));
    };

    return c.json({
      success: true,
      live: attachPlayers([...waitingRaw, ...liveRaw]),
      daily: attachPlayers(finishedRaw.filter(b => b.endedAt && new Date(b.endedAt) >= todayStart)),
      mine: attachPlayers(myBattlesRaw),
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[battles/lobby] error:', err.message);
    return c.json({ error: 'Failed to fetch lobby data' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /battles/state?battleId=...
// Room state is served through the backend so preview origins never
// call the protected core DB API directly (which can be blocked by CORS).
// ──────────────────────────────────────────────────────────────
app.get('/state', async (c) => {
  try {
    await requireAuth(c);
  } catch {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const battleId = c.req.query('battleId');
  if (!battleId) return c.json({ error: 'battleId required' }, 400);

  const blink = getBlinkServer(c.env as any);
  try {
    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);

    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    let packs: any[] = [];
    try { packs = JSON.parse(battle.packsJson || '[]'); } catch { packs = []; }
    const packIds = [...new Set(packs.map((pack: any) => pack.id).filter(Boolean))] as string[];
    const packCards = packIds.length > 0
      ? await blink.db.packCards.list({ where: { packId: { in: packIds } } }) as any[]
      : [];

    return c.json({ success: true, battle, players, packCards });
  } catch (err: any) {
    console.error('[battles/state] error:', err.message);
    return c.json({ error: 'Failed to fetch battle state' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/create
// ──────────────────────────────────────────────────────────────
app.post('/create', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { selectedPackIds, mode, playerCount, isPublic, teamMode } = body;

    if (!Array.isArray(selectedPackIds) || selectedPackIds.length === 0) {
      return c.json({ error: 'selectedPackIds required' }, 400);
    }

    // Fetch user
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    const currentBalance = Number(user.balance || 0);
    const currentMatchedBalance = Number(user.matchedBalance || user.matched_balance || 0);

    // Fetch all selected packs in one batch query while preserving selection order
    // and duplicates. Prices and active status remain authoritative on the server.
    const uniquePackIds = [...new Set(selectedPackIds)] as string[];
    const fetchedPacks = await blink.db.packsCatalog.list({
      where: { id: { in: uniquePackIds } },
      limit: uniquePackIds.length,
    }) as any[];
    const packById = new Map(fetchedPacks.map((pack: any) => [pack.id, pack]));
    const packs: any[] = [];
    for (const pid of selectedPackIds) {
      const p = packById.get(pid);
      if (!p || !Number(p.isActive)) return c.json({ error: `Pack ${pid} not found or inactive` }, 400);
      packs.push(p);
    }

    const totalCost = packs.reduce((s: number, p: any) => s + Number(p.price), 0);

    const totalSpendableBalance = currentBalance + currentMatchedBalance;
    if (totalCost > totalSpendableBalance) {
      return c.json({ error: `Insufficient balance. Need ${totalCost.toFixed(2)}, have ${totalSpendableBalance.toFixed(2)}` }, 400);
    }

    // Enforce global maximum of 4 participants per battle
    const GLOBAL_MAX_PLAYERS = 4;
    const effectivePlayerCount = Math.min(Number(playerCount) || 2, GLOBAL_MAX_PLAYERS);
    const isTeamBattle = Boolean(teamMode) && effectivePlayerCount === 4;

    const battleId = `battle_${uid()}`;
    const username = user.username || user.displayName || 'Trainer';
    const avatar = user.avatarUrl || '';

    const packsJson = JSON.stringify(packs.map((p: any) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      price: Number(p.price),
      borderColor: p.borderColor,
      glowColor: p.glowColor,
    })));

    const privateCode = !isPublic ? uid().slice(0, 6).toUpperCase() : null;

    // Create battle
    await blink.db.battles.create({
      id: battleId,
      hostUserId: userId,
      hostUsername: username,
      hostAvatar: avatar,
      mode: mode || 'standard',
      playerCount: effectivePlayerCount,
      teamMode: isTeamBattle ? 1 : 0,
      isPublic: isPublic ? 1 : 0,
      status: 'waiting',
      packsJson,
      totalCost,
      privateCode,
    });

    // Auto-join host
    await blink.db.battlePlayers.create({
      id: `bp_${uid()}`,
      battleId,
      userId,
      username,
      avatar,
      isAi: 0,
      teamSide: isTeamBattle ? 'left' : null,
      cardsJson: '[]',
      totalValue: 0,
      isWinner: 0,
    });

    // Deduct balance (matched balance first) via wallet
    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'battle_entry',
      amount: -totalCost,
      matchedAmount: totalCost,
      sourceId: battleId,
    });

    if (!walletResult.success) {
      return c.json({ error: walletResult.error || 'Failed to deduct balance' }, 500);
    }

    const nb = walletResult.balanceAfter;

    // Log transaction
    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'battle_entry',
      amount: -totalCost,
      description: `Pack Battle entry (${packs.length} pack${packs.length > 1 ? 's' : ''})`,
    });

    // Notify public lobby subscribers immediately; polling remains the fallback.
    if (isPublic) {
      try {
        await blink.realtime.publish('battle-lobby', 'battle_created', { battleId });
      } catch (realtimeErr: any) {
        console.warn('[battles/create] Lobby realtime publish failed:', realtimeErr?.message);
      }
    }

    return c.json({ success: true, battleId, privateCode, newBalance: nb });

  } catch (err: any) {
    console.error('[battles/create] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/resolve-code
// Resolve a private invite code without exposing private battles
// in the public lobby feed.
// ──────────────────────────────────────────────────────────────
app.post('/resolve-code', async (c) => {
  try {
    await requireAuth(c);
  } catch (err: any) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const privateCode = String(body?.privateCode || '').trim().toUpperCase();
    if (!privateCode) return c.json({ error: 'Private code required' }, 400);

    const battles = await blink.db.battles.list({
      where: { privateCode, isPublic: 0, status: 'waiting' },
      limit: 1,
    }) as any[];
    const battle = battles[0];
    if (!battle) return c.json({ error: 'Invalid code' }, 404);

    return c.json({
      success: true,
      battleId: battle.id,
      privateCode: battle.privateCode,
    });
  } catch (err: any) {
    console.error('[battles/resolve-code] error:', err.message);
    return c.json({ error: 'Invalid code' }, 404);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/join
// ──────────────────────────────────────────────────────────────
app.post('/join', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId, teamSide } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    const currentBalance = Number(user.balance || 0);
    const currentMatchedBalance = Number(user.matchedBalance || user.matched_balance || 0);

    // Check if already joined
    const existing = await blink.db.battlePlayers.list({ where: { battleId, userId } }) as any[];
    if (existing.length > 0) {
      return c.json({ success: true, alreadyJoined: true, newBalance: currentBalance });
    }

    // Fetch battle
    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.status !== 'waiting') return c.json({ error: 'Battle is no longer accepting players' }, 400);

    const totalCost = Number(battle.totalCost);
    const totalSpendableBalance2 = currentBalance + currentMatchedBalance;
    if (totalCost > totalSpendableBalance2) {
      return c.json({ error: `Insufficient balance. Need ${totalCost.toFixed(2)}` }, 400);
    }

    // Check capacity (global max = 4)
    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    const MAX_PARTICIPANTS = 4;
    const effectiveMax = Math.min(Number(battle.playerCount) || 2, MAX_PARTICIPANTS);
    const isTeamBattle = Number(battle.teamMode || battle.team_mode) > 0;
    let assignedTeamSide: 'left' | 'right' | null = null;
    if (isTeamBattle) {
      const leftCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'left').length;
      const rightCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'right').length;
      if (players.length >= MAX_PARTICIPANTS) return c.json({ error: 'Battle is full' }, 400);
      if (players.length === MAX_PARTICIPANTS - 1) {
        assignedTeamSide = leftCount < 2 ? 'left' : 'right';
      } else if (teamSide === 'left' || teamSide === 'right') {
        assignedTeamSide = teamSide;
        if ((teamSide === 'left' ? leftCount : rightCount) >= 2) {
          return c.json({ error: `${teamSide === 'left' ? 'Left' : 'Right'} Team is full` }, 400);
        }
      } else {
        return c.json({ error: 'Choose Left Team or Right Team' }, 400);
      }
    }
    if (!isTeamBattle && players.length >= effectiveMax) {
      return c.json({ error: 'Battle is full' }, 400);
    }

    const username = user.username || user.displayName || 'Trainer';
    const avatar = user.avatarUrl || '';

    // Join
    try {
      await blink.db.battlePlayers.create({
        id: `bp_${uid()}`,
        battleId,
        userId,
        username,
        avatar,
        isAi: 0,
        teamSide: assignedTeamSide,
        cardsJson: '[]',
        totalValue: 0,
        isWinner: 0,
      });
    } catch (err: any) {
      if (err?.status === 409 || err?.details?.code === '23505') {
        const joined = await blink.db.battlePlayers.list({ where: { battleId, userId }, limit: 1 }) as any[];
        if (joined.length > 0) {
          return c.json({ success: true, alreadyJoined: true, newBalance: currentBalance });
        }
      }
      throw err;
    }

    // Deduct balance (matched balance first) via wallet
    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'battle_entry',
      amount: -totalCost,
      matchedAmount: totalCost,
      sourceId: battleId,
    });

    if (!walletResult.success) {
      return c.json({ error: walletResult.error || 'Failed to deduct balance' }, 500);
    }

    const nb = walletResult.balanceAfter;

    // Log transaction
    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'battle_entry',
      amount: -totalCost,
      description: `Pack Battle entry fee`,
    });

    return c.json({ success: true, newBalance: nb });

  } catch (err: any) {
    console.error('[battles/join] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/start-countdown
// ──────────────────────────────────────────────────────────────
app.post('/start-countdown', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.hostUserId !== userId) return c.json({ error: 'Only host can start countdown' }, 403);
    
    // Only allow starting from 'waiting' status. The client can issue this
    // request more than once while polling, so the backend owns this gate.
    if (battle.status !== 'waiting') {
      return c.json({ success: true, alreadyStarted: true });
    }

    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    const effectivePlayerCount = Math.min(Number(battle.playerCount) || 2, 4);
    const isTeamBattle = Number(battle.teamMode || battle.team_mode) > 0;

    // Never begin the countdown before the configured lobby is full. This
    // prevents a race where the lobby enters `starting` while the host is
    // still choosing an AI opponent.
    if (!isTeamBattle && players.length < effectivePlayerCount) {
      return c.json({ error: `Waiting for players (${players.length}/${effectivePlayerCount})` }, 400);
    }

    // Prevent battles > 4 participants from starting
    if (players.length > 4) {
      return c.json({ error: 'Battle has too many participants. Maximum is 4.' }, 400);
    }
    if (Number(battle.teamMode || battle.team_mode) > 0) {
      const leftCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'left').length;
      const rightCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'right').length;
      if (leftCount !== 2 || rightCount !== 2) {
        return c.json({ error: '2v2 requires two players on each team.' }, 400);
      }
    }

    await blink.db.battles.update(battleId, { 
      status: 'starting'
    });

    return c.json({ success: true });
  } catch (err: any) {
    console.error('[battles/start-countdown] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/cancel
// ──────────────────────────────────────────────────────────────
app.post('/cancel', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.hostUserId !== userId) return c.json({ error: 'Only host can cancel' }, 403);
    if (battle.status !== 'waiting') return c.json({ error: 'Cannot cancel battle in current state' }, 400);

    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    const humanPlayers = players.filter((p: any) => !Number(p.isAi));
    if (humanPlayers.length > 1) {
      return c.json({ error: 'Cannot cancel: another player has joined' }, 400);
    }

    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);

    const refundAmount = Number(battle.totalCost);

    // Look up original battle_entry wallet ledger to determine matched vs real split
    const originalLedgerId = `wt_battle_entry_${userId}_${battleId}`;
    let matchedSpent = 0;
    try {
      const originalEntry = await blink.db.table('walletTransactions').get(originalLedgerId) as any;
      if (originalEntry) {
        matchedSpent = Math.max(0, Number(originalEntry.matchedBefore || 0) - Number(originalEntry.matchedAfter || 0));
      }
    } catch { /* ledger lookup is best-effort */ }

    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'battle_cancel',
      amount: refundAmount,
      matchedAmount: matchedSpent,
      sourceId: battleId,
    });

    if (!walletResult.success) {
      return c.json({ error: walletResult.error || 'Failed to refund balance' }, 500);
    }

    const newBalance = walletResult.balanceAfter;

    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'refund',
      amount: refundAmount,
      description: `Cancelled Pack Battle: ${battleId}`,
    });
    await blink.db.battles.update(battleId, { status: 'canceled' });

    return c.json({ success: true, newBalance });

  } catch (err: any) {
    console.error('[battles/cancel] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /battles/add-ai
// ──────────────────────────────────────────────────────────────
app.post('/add-ai', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') {
      return c.json({ error: 'Account deactivated' }, 403);
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json();
    const { battleId, aiName } = body;
    if (!battleId) return c.json({ error: 'battleId required' }, 400);

    const battle = await blink.db.battles.get(battleId) as any;
    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    
    // Check if user is a player in this battle
    const players = await blink.db.battlePlayers.list({ where: { battleId } }) as any[];
    const isPlayer = players.some((p: any) => p.userId === userId);
    
    if (!isPlayer) return c.json({ error: 'Only players in the battle can add AI' }, 403);

    // Fetch user to check verification
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    
    // A stale start-countdown request can briefly move the room to `starting`
    // before the bot click reaches the server. If the battle has not filled
    // its configured lobby and no cards have been dealt, safely reopen it so
    // the host can finish choosing opponents. Once the lobby is full, starting
    // remains final and bots cannot be inserted into an active battle.
    const effectivePlayerCount = Math.min(Number(battle.playerCount) || 2, 4);
    if (battle.status === 'starting' && players.length < effectivePlayerCount) {
      await blink.db.battles.update(battleId, { status: 'waiting' });
      battle.status = 'waiting';
    }
    // A late selector click must not surface a false failure after the room
    // has already started. The execution route remains the authority for the
    // actual battle outcome.
    if (battle.status !== 'waiting') {
      return c.json({ success: true, aiName: String(aiName || '') || 'AI', alreadyAdded: true });
    }

    // ── Hard capacity enforcement (global max = 4) ──────────────────────────
    const maxSlots = 4;
    if (players.length >= maxSlots) {
      return c.json({ error: 'Battle is full' }, 400);
    }

    const isTeamBattle = Number(battle.teamMode || battle.team_mode) > 0;
    const leftCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'left').length;
    const rightCount = players.filter((p: any) => (p.teamSide || p.team_side) === 'right').length;
    // In 2v2, bots fill the remaining open team slot automatically. This keeps
    // team assignment deterministic and prevents a bot with no side from
    // blocking the both-teams-full start condition.
    const assignedTeamSide = isTeamBattle
      ? (leftCount < 2 ? 'left' : rightCount < 2 ? 'right' : null)
      : null;
    if (isTeamBattle && !assignedTeamSide) {
      return c.json({ error: 'Both teams are full' }, 400);
    }

    const requestedName = String(aiName || '').trim();
    const name = AI_NAMES.includes(requestedName)
      ? requestedName
      : AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
    const aiPlayerId = `bp_ai_${uid()}`;

    // Insert only while capacity is still available. The conditional INSERT is
    // evaluated atomically, so concurrent clicks cannot exceed four players.
    const aiUserId = `ai_${uid()}`;
    const insertResult = await blink.db.sql(
      `INSERT INTO battle_players
        (id, battle_id, user_id, username, avatar, is_ai, team_side, cards_json, total_value, is_winner)
       SELECT ?, ?, ?, ?, '', 1, ?, '[]', 0, 0
       WHERE (SELECT COUNT(*) FROM battle_players WHERE battle_id = ?) < ?
       RETURNING id`,
      [aiPlayerId, battleId, aiUserId, name, assignedTeamSide, battleId, maxSlots],
    ) as any;

    if (!insertResult?.rows?.length) {
      return c.json({ error: 'Battle is full' }, 400);
    }

    return c.json({ success: true, aiName: name });

  } catch (err: any) {
    console.error('[battles/add-ai] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;