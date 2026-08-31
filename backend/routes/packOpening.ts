/**
 * Pack Opening Routes — all economy logic runs server-side only.
 * 
 * POST /open-pack
 *   - Verifies auth, balance, cooldown, quantity
 *   - Picks card using PROVABLY FAIR HMAC-SHA256 deterministic roll
 *   - Saves card to inventory FIRST (before deducting balance)
 *   - Deducts balance, logs transaction
 *   - Returns the drawn card to the frontend (for animation only)
 *   - Stores clientSeed, nonce, rollValue, serverSeedHash, oddsVersionHash
 *     in packs_opened for independent verification
 * 
 * The card is owned by the player the moment this endpoint returns success.
 * Closing the modal, refreshing, or leaving the page will NOT lose the card.
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../lib/provablyFair';

const app = new Hono();

const RARITY_EMOJIS: Record<string, string> = {
  common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
};

app.post('/open-pack', async (c) => {
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
    const body = await c.req.json().catch(() => ({}));
    const { packId } = body;

    if (!packId) return c.json({ error: 'packId required' }, 400);

    // 1+2. Fetch pack and user in parallel (independent reads)
    let pack: any;
    let user: any;
    try {
      [pack, user] = await Promise.all([
        blink.db.packsCatalog.get(packId) as any,
        blink.db.users.get(userId) as any,
      ]);
    } catch (fetchErr: any) {
      console.error('[open-pack] STEP-1 FETCH failed:', fetchErr?.message ?? fetchErr);
      return c.json({ error: 'Failed to fetch pack data. Please try again.' }, 500);
    }
    if (!pack || !Number(pack.isActive)) {
      return c.json({ error: 'Pack not found or inactive' }, 404);
    }

    const packPrice = Number(pack.price);

    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    
    const currentBalance = Number(user.balance || 0);

    // 3. Check expiry
    if (pack.expiresAt && new Date(pack.expiresAt) < new Date()) {
      return c.json({ error: 'This pack has expired' }, 400);
    }

    // 4. Check quantity
    const quantityLimit = Number(pack.quantityLimit || 0);
    const currentQuantity = Number(pack.currentQuantity || 0);
    if (quantityLimit > 0 && currentQuantity <= 0) {
      return c.json({ error: 'Pack is sold out' }, 400);
    }

    // 5. Check cooldown
    const cooldownHours = Number(pack.cooldownHours || 0);
    if (cooldownHours > 0) {
      const cooldownRows = await blink.db.packCooldowns.list({
        where: { userId, packId }
      }) as any[];
      const cooldown = cooldownRows[0];
      if (cooldown) {
        const lastOpened = new Date(cooldown.lastOpenedAt);
        const diffHours = (Date.now() - lastOpened.getTime()) / (1000 * 60 * 60);
        if (diffHours < cooldownHours) {
          const remainingHours = Math.ceil(cooldownHours - diffHours);
          return c.json({ error: `Cooldown active: ${remainingHours}h remaining` }, 400);
        }
      }
    }

    // 6. Check balance (real + matched)
    const totalSpendableBalance = currentBalance + Number(user.matchedBalance || user.matched_balance || 0);
    if (packPrice > 0 && totalSpendableBalance < packPrice) {
      return c.json({ error: `Insufficient balance. Need ${packPrice.toFixed(2)}, have ${totalSpendableBalance.toFixed(2)}` }, 400);
    }

    // 7. Fetch card pool from DB
    let dbCards: any[];
    try {
      dbCards = await blink.db.packCards.list({
        where: { packId },
        orderBy: { sortOrder: 'asc' }
      }) as any[];
    } catch (cardFetchErr: any) {
      console.error('[open-pack] STEP-7 CARD-POOL failed:', cardFetchErr?.message ?? cardFetchErr);
      return c.json({ error: 'Failed to load card pool. Please try again.' }, 500);
    }

    const isMysteryPack = (pack.packType || pack.pack_type || 'standard') === 'mystery';
    if (isMysteryPack) {
      dbCards = dbCards.filter((card: any) => Number(card.quantity ?? card.quantity_ ?? card.quantity) > 0);
      const totalUnits = dbCards.reduce((sum: number, card: any) => sum + Number(card.quantity ?? 0), 0);
      dbCards = dbCards.map((card: any) => ({
        ...card,
        // Mystery Packs draw uniformly from individual available units.
        pullChance: totalUnits > 0 ? (Number(card.quantity ?? 0) / totalUnits) * 100 : 0,
      }));
    }

    if (dbCards.length === 0) {
      return c.json({ error: isMysteryPack ? 'This Mystery Pack is sold out' : 'No cards configured for this pack' }, 400);
    }

    // 8. PROVABLY FAIR — deterministic card selection ──────────────────────
    // 8a. Read and validate server seed
    const serverSeed = c.env.BLINK_SERVER_SEED;
    if (!serverSeed) {
      console.error('[open-pack] BLINK_SERVER_SEED env var not set — cannot open packs');
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }

    // Accept either active or pending seed (pending exists during two-phase rotation window)
    const seedRows = await blink.db.serverSeeds.list({
      orderBy: { createdAt: 'desc' },
      limit: 10,
    }) as any[];

    // Filter to active or pending seeds and find the one matching the env var
    const matchingSeed = seedRows.find((r: any) => r.status === 'active' || r.status === 'pending');
    if (!matchingSeed) {
      console.error('[open-pack] No active or pending server seed in DB');
      return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    }

    const actualSeedHash = await sha256(serverSeed);
    // The env var seed hash must match either the active or pending seed
    const matchedRow = seedRows.find(
      (r: any) => (r.status === 'active' || r.status === 'pending') && r.seedHash === actualSeedHash,
    );
    if (!matchedRow) {
      console.error('[open-pack] CRITICAL: BLINK_SERVER_SEED hash mismatch! Hash does not match active or pending seed.');
      console.error(`[open-pack] Env hash: ${actualSeedHash}  Active/pending hashes: ${seedRows.filter((r: any) => r.status === 'active' || r.status === 'pending').map((r: any) => r.seedHash).join(', ')}`);
      return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    }

    // 8b. Build odds snapshot and hash it
    const oddsJson = buildOddsSnapshot(dbCards);
    const oddsVersionHash = await sha256(oddsJson);

    // Upsert odds version (idempotent — non-critical)
    try {
      await blink.db.table('packOddsVersions').upsert({
        contentHash: oddsVersionHash,
        packId,
        oddsJson,
        cardCount: dbCards.length,
      });
    } catch { /* non-critical */ }

    // 8c. Atomic per-user nonce increment — the SDK CRUD methods (create/update)
    //     internally resolve rows by column 'id', but user_nonces PK is 'user_id'.
    //     Strategy: atomic SQL INSERT ON CONFLICT for the write (proven reliable),
    //     SDK list() for the read-back (also proven — returns camelCase fields).
    //     If either step fails, we block the pack open — no silent fallback.
    let nonce = 1;
    try {
      // Atomic upsert: insert with nonce=1, or increment existing by 1.
      // SQLite handles the increment atomically on the user_id PK.
      await blink.db.sql(
        `INSERT INTO user_nonces (user_id, pack_nonce) VALUES (?, 1)
         ON CONFLICT(user_id) DO UPDATE SET pack_nonce = pack_nonce + 1`,
        [userId]
      );

      // Read back the committed nonce via SDK list() — returns camelCase
      // properties (packNonce, not pack_nonce).
      const nonceRows = await blink.db.table('userNonces').list({
        where: { userId },
        limit: 1,
      }) as any[];

      if (nonceRows && nonceRows.length > 0) {
        // SDK converts snake_case→camelCase; column pack_nonce → property packNonce
        const dbNonce = nonceRows[0].packNonce ?? nonceRows[0].pack_nonce;
        if (dbNonce !== undefined && dbNonce !== null) {
          nonce = Number(dbNonce);
        } else {
          console.error('[open-pack] CRITICAL: nonce field missing from read-back row. Row=' + JSON.stringify(nonceRows[0]));
          return c.json({ error: 'Provably fair system error — nonce read failed. Please try again.' }, 500);
        }
      } else {
        console.error('[open-pack] CRITICAL: nonce read-back returned empty. userId=' + userId);
        return c.json({ error: 'Provably fair system error — nonce read failed. Please try again.' }, 500);
      }
    } catch (nonceErr: any) {
      console.error('[open-pack] CRITICAL: Nonce persistence failed:', nonceErr?.message, nonceErr?.stack);
      return c.json({ error: 'Provably fair system error — nonce persistence failed. Please try again.' }, 500);
    }

    // 8d. Generate client seed (server-side for Phase 1)
    const clientSeed = `cs_${uid()}`;

    // 8e. Compute deterministic roll
    const rollValue = await computeRoll(serverSeed, clientSeed, nonce);

    // 8f. Select card deterministically
    const cardIndex = selectCardIndex(rollValue, dbCards);
    const pickedRaw = dbCards[cardIndex] as any;

    // Mystery Packs use per-card inventory. Atomically claim one copy before
    // awarding it so concurrent opens cannot pull the same final copy.
    if (isMysteryPack) {
      const claimed = await blink.db.sql(
        'UPDATE pack_cards SET quantity = quantity - 1 WHERE id = ? AND quantity > 0 RETURNING id',
        [pickedRaw.id],
      );
      if (!claimed.rows || claimed.rows.length !== 1) {
        return c.json({ error: 'That Mystery Pack card just sold out. Please try again.' }, 409);
      }

      const remaining = await blink.db.sql(
        'SELECT COALESCE(SUM(quantity), 0) AS total_quantity FROM pack_cards WHERE pack_id = ?',
        [packId],
      );
      const totalQuantity = Number(remaining.rows?.[0]?.total_quantity ?? 0);
      await blink.db.packsCatalog.update(packId, { currentQuantity: totalQuantity });
    }
    
    console.log(`[open-pack] PV roll=${rollValue} nonce=${nonce} clientSeed=${clientSeed} index=${cardIndex}`);

    // Robustly extract fields (handle both camelCase and snake_case from SDK)
    const cardName = pickedRaw.cardName || pickedRaw.card_name || 'Unknown Card';
    const rarity = pickedRaw.rarity || 'common';
    const estimatedValue = pickedRaw.estimatedValue ?? pickedRaw.estimated_value ?? 0;
    const cardImageUrl = pickedRaw.cardImageUrl || pickedRaw.card_image_url || null;
    
    const cardValue = Number(estimatedValue);
    const cardId = `${cardName.toLowerCase().replace(/\s+/g, '_')}_${rarity}`;

    console.log(`[open-pack] User ${userId} pulled ${cardName} (${cardValue}) from ${pack.name}`);

    // === STEP A: Save card to inventory FIRST ===
    // This is the critical step. If this fails, we abort and the user's balance is NOT deducted.
    // If this succeeds, the card is permanently owned by the player regardless of what happens next.
    const isBot = user.isBot === true || Number(user.is_bot || 0) > 0;
    const recipientId = getRewardUserId(userId, isBot);
    
    const inventoryId = `inv_${uid()}`;
    try {
      await blink.db.inventory.create({
        id: inventoryId,
        userId: recipientId,
        cardId,
        cardName,
        rarity,
        value: cardValue,
        emoji: RARITY_EMOJIS[rarity] || '🃏',
        isFavorite: 0,
        isLocked: 0,
        cardImageUrl,
        packName: pack.name,
      });
      console.log(`[open-pack] ✅ Card secured in inventory: ${inventoryId} for user ${recipientId}`);
    } catch (invErr: any) {
      console.error(`[open-pack] ❌ CRITICAL: Failed to create inventory record: ${invErr.message}`);
      throw new Error(`Failed to secure card in inventory. No balance was deducted. Please try again.`);
    }

    // === STEP B: Deduct balance (matched first) via wallet ===
    // Use inventoryId as sourceId — unique per open (prevents cross-user idempotency collision)
    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'pack_open',
      amount: -packPrice,
      matchedAmount: Number(user.matchedBalance || user.matched_balance || 0),
      sourceId: inventoryId,
    });

    if (!walletResult.success) {
      console.error('[open-pack] STEP-B WALLET failed:', walletResult.error);
      throw new Error(`Failed to deduct balance: ${walletResult.error}`);
    }

    // === STEPS C–F: Non-critical writes — parallelise to reduce latency ===
    // These do not affect whether the user owns the card or their balance.
    // If any fail, the response still succeeds — they are logged and retryable.
    const nonCriticalWrites: Promise<unknown>[] = [];

    // STEP C: Decrement pack quantity
    if (quantityLimit > 0 && !isMysteryPack) {
      nonCriticalWrites.push(
        blink.db.packsCatalog.update(packId, {
          currentQuantity: Math.max(0, currentQuantity - 1),
        })
      );
    }

    // STEP D: Update cooldown
    if (cooldownHours > 0) {
      const now = new Date().toISOString();
      nonCriticalWrites.push(
        blink.db.packCooldowns.upsert({
          id: `${userId}_${packId}`,
          userId,
          packId,
          lastOpenedAt: now,
        })
      );
    }

    // STEP E: Log pack opened record with provably fair verification data
    nonCriticalWrites.push(
      blink.db.table('packsOpened').create({
        id: `po_${uid()}`,
        userId,
        packId,
        packName: pack.name,
        cost: packPrice,
        cardName,
        rarity,
        clientSeed,
        nonce,
        rollValue,
        serverSeedHash: actualSeedHash,
        oddsVersionHash,
        provablyFair: 1,
      })
    );

    // STEP F: Log transaction
    nonCriticalWrites.push(
      blink.db.transactions.create({
        id: `txn_${uid()}`,
        userId,
        type: 'pack_open',
        amount: -packPrice,
        description: `Opened ${pack.name} — pulled ${cardName} (inv:${inventoryId})`,
      })
    );

    // Await all non-critical writes in parallel. Individual failures are caught
    // so one failing audit record doesn't block the response. We still await the
    // allSettled so the response doesn't return before writes are in-flight.
    await Promise.allSettled(
      nonCriticalWrites.map(p => p.catch(err => {
        console.error('[open-pack] Non-critical write failed:', err?.message ?? err);
      }))
    );

    // === STEPS G–H: Leaderboard + activity log — fire-and-forget ===
    // These are purely informational; the user's card and balance are already
    // committed. We never await these — the response fires immediately.
    scheduleLeaderboardUpdate(blink, userId, user, cardValue);
    scheduleActivityLog(blink, userId, user, pack, cardName, cardValue, rarity, inventoryId, packPrice);

    // === Return result to frontend ===
    return c.json({
      success: true,
      card: {
        name: cardName,
        rarity,
        value: cardValue,
        emoji: RARITY_EMOJIS[rarity] || '🃏',
        imageUrl: cardImageUrl,
      },
      inventoryId,
      newBalance: walletResult.balanceAfter,
      newMatchedBalance: walletResult.matchedAfter,
    });

  } catch (err: any) {
    console.error('[open-pack] UNHANDLED error:', err?.message ?? err, err?.stack ?? '');
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ── Fire-and-forget helpers ──────────────────────────────────────────────────
// These run after the response is sent. Failures are logged but never
// surfaced to the user — their card and balance are already committed.

async function scheduleLeaderboardUpdate(
  blink: ReturnType<typeof import('../lib/auth').getBlinkServer>,
  userId: string,
  user: any,
  cardValue: number,
): Promise<void> {
  try {
    const existingStats = await blink.db.leaderboardStats.list({ where: { id: userId } }) as any[];
    const ls = existingStats[0];
    if (ls) {
      const newBiggest = Math.max(Number(ls.biggestPull || 0), cardValue);
      await blink.db.leaderboardStats.update(ls.id, {
        packsOpened: Number(ls.packsOpened || 0) + 1,
        biggestPull: newBiggest,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await blink.db.leaderboardStats.create({
        id: userId,
        username: user.username || user.displayName || 'Trainer',
        biggestPull: cardValue,
        packsOpened: 1,
        winStreak: 0,
        upgradesAttempted: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.error('[open-pack] Leaderboard update failed:', err?.message ?? err);
  }
}

async function scheduleActivityLog(
  blink: ReturnType<typeof import('../lib/auth').getBlinkServer>,
  userId: string,
  user: any,
  pack: any,
  cardName: string,
  cardValue: number,
  rarity: string,
  inventoryId: string,
  packPrice: number,
): Promise<void> {
  try {
    const username = user.username || user.displayName || 'Trainer';
    await writeLog(blink, {
      type: 'pack_open',
      userId,
      username,
      action: `Opened ${pack.name}`,
      details: {
        packName: pack.name,
        packCost: packPrice,
        cardWon: cardName,
        cardValue,
        rarity,
        emoji: RARITY_EMOJIS[rarity] || '🃏',
        packId: pack.id,
        inventoryId,
      },
      valueIn: packPrice,
      valueOut: cardValue,
      result: 'pulled',
    });
  } catch (err: any) {
    console.error('[open-pack] Activity log failed:', err?.message ?? err);
  }
}

export default app;