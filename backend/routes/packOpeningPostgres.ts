import { Hono } from 'hono';
import { requireAuth, uid, getRewardUserId } from '../lib/auth';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../lib/provablyFair';
import { getPack, listPackCards, getPackCooldown } from '../db/repositories/packs';
import { getActiveOrPendingServerSeed, recordPackOddsVersion } from '../db/repositories/provablyFair';
import { finalizePackOpen } from '../db/repositories/packOpening';

const app = new Hono();
const RARITY_EMOJIS: Record<string, string> = {
  common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
};

app.post('/open-pack', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    const message = err?.message;
    if (message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    if (message === 'ACCOUNT_BANNED') return c.json({ error: 'Account banned' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const packId = body?.packId;
    if (!packId) return c.json({ error: 'packId required' }, 400);

    const [pack, cards] = await Promise.all([getPack(c.env as any, packId), listPackCards(c.env as any, packId)]);
    if (!pack || !pack.isActive) return c.json({ error: 'Pack not found or inactive' }, 404);

    const now = new Date();
    if (pack.expiresAt && new Date(pack.expiresAt) < now) return c.json({ error: 'This pack has expired' }, 400);
    if (pack.quantityLimit > 0 && pack.currentQuantity <= 0) return c.json({ error: 'Pack is sold out' }, 400);

    if (pack.cooldownHours > 0) {
      const lastOpened = await getPackCooldown(c.env as any, userId, packId);
      if (lastOpened) {
        const elapsed = now.getTime() - new Date(lastOpened).getTime();
        const cooldownMs = pack.cooldownHours * 3600000;
        if (elapsed < cooldownMs) {
          return c.json({ error: `Cooldown active: ${Math.ceil((cooldownMs - elapsed) / 3600000)}h remaining` }, 400);
        }
      }
    }

    let dbCards = cards;
    const isMysteryPack = pack.packType === 'mystery';
    if (isMysteryPack) {
      dbCards = dbCards.filter(card => card.quantity > 0);
      const totalUnits = dbCards.reduce((sum, card) => sum + card.quantity, 0);
      dbCards = dbCards.map(card => ({ ...card, pullChance: totalUnits > 0 ? (card.quantity / totalUnits) * 100 : 0 }));
    }
    if (!dbCards.length) return c.json({ error: isMysteryPack ? 'This Mystery Pack is sold out' : 'No cards configured for this pack' }, 400);

    const serverSeed = c.env.BLINK_SERVER_SEED;
    if (!serverSeed) return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    const actualSeedHash = await sha256(serverSeed);
    const seed = await getActiveOrPendingServerSeed(c.env as any, actualSeedHash);
    if (!seed) {
      console.error('[open-pack] server seed hash mismatch or no active seed');
      return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    }

    const oddsJson = buildOddsSnapshot(dbCards);
    const oddsVersionHash = await sha256(oddsJson);
    await recordPackOddsVersion(c.env as any, {
      contentHash: oddsVersionHash,
      packId,
      oddsJson,
      cardCount: dbCards.length,
    });

    const clientSeed = `cs_${uid()}`;
    const nonceRow = await (async () => {
      // Reserve the nonce using PostgreSQL's atomic counter. The final write
      // transaction is separately serialized on the user's wallet row.
      const { getDb } = await import('../db/client');
      const result = await getDb(c.env as any).query(
        `INSERT INTO user_nonces (user_id, pack_nonce) VALUES ($1, 1)
         ON CONFLICT (user_id) DO UPDATE SET pack_nonce = user_nonces.pack_nonce + 1
         RETURNING pack_nonce`,
        [userId],
      );
      return Number(result.rows[0].pack_nonce);
    })();

    const rollValue = await computeRoll(serverSeed, clientSeed, nonceRow);
    const cardIndex = selectCardIndex(rollValue, dbCards);
    const selectedCard = dbCards[cardIndex];
    const inventoryId = `inv_${uid()}`;

    const result = await finalizePackOpen(c.env as any, {
      userId,
      recipientId: getRewardUserId(userId, false),
      pack,
      card: selectedCard,
      inventoryId,
      packOpeningId: `po_${uid()}`,
      walletTransactionId: `wtx_${uid()}`,
      transactionId: `txn_${uid()}`,
      clientSeed,
      nonce: nonceRow,
      rollValue,
      serverSeedHash: actualSeedHash,
      oddsVersionHash,
      emoji: RARITY_EMOJIS[selectedCard.rarity || 'common'] || '🃏',
      now,
    });

    if (!result.success) {
      return c.json({ error: result.conflict ? result.error : result.error || 'Failed to open pack' }, result.conflict ? 409 : 400);
    }

    return c.json({
      success: true,
      card: {
        name: selectedCard.cardName,
        rarity: selectedCard.rarity || 'common',
        value: selectedCard.estimatedValue,
        emoji: RARITY_EMOJIS[selectedCard.rarity || 'common'] || '🃏',
        imageUrl: selectedCard.cardImageUrl,
      },
      inventoryId,
      newBalance: result.balanceAfter,
      newMatchedBalance: result.matchedAfter,
    });
  } catch (err: any) {
    console.error('[open-pack/postgres] error:', err?.message || err);
    return c.json({ error: err?.message || 'Internal server error' }, 500);
  }
});

export default app;
