/**
 * Exchanger Routes — card trade validation is server-side.
 *
 * POST /exchanger/trade
 *   - Verifies auth and card ownership
 *   - Server validates that receive value ≤ offer value
 *   - Removes offered cards, grants requested cards, refunds difference
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';

const app = new Hono();

const RARITY_EMOJIS: Record<string, string> = {
  common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
};

app.post('/exchanger/trade', async (c) => {
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
    const { offerInventoryIds, receivePackCardIds } = body;

    if (!Array.isArray(offerInventoryIds) || offerInventoryIds.length === 0) {
      return c.json({ error: 'offerInventoryIds required' }, 400);
    }
    if (!Array.isArray(receivePackCardIds) || receivePackCardIds.length === 0) {
      return c.json({ error: 'receivePackCardIds required' }, 400);
    }

    // 1. Fetch user
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    const currentBalance = Number(user.balance || 0);

    // 2. Verify offered cards belong to this user and are not locked
    const userCards = await blink.db.inventory.list({ where: { userId } }) as any[];
    const userCardMap = Object.fromEntries(userCards.map((c: any) => [c.id, c]));

    const offeredCards: any[] = [];
    for (const invId of offerInventoryIds) {
      const card = userCardMap[invId];
      if (!card) return c.json({ error: `Card ${invId} not in your inventory` }, 400);
      if (Number(card.isLocked) > 0) return c.json({ error: `Card ${invId} is locked` }, 400);
      offeredCards.push(card);
    }

    // 3. Fetch receive cards from pack_cards (catalog) — single batch query
    const fetchedReceiveCards = await blink.db.packCards.list({
      where: { id: { in: receivePackCardIds } }
    }) as any[];
    const receiveCardMap = Object.fromEntries(fetchedReceiveCards.map((c: any) => [c.id, c]));
    const receiveCards: any[] = [];
    for (const packCardId of receivePackCardIds) {
      const pc = receiveCardMap[packCardId];
      if (!pc) return c.json({ error: `Market card ${packCardId} not found` }, 400);
      receiveCards.push(pc);
    }

    // 4. SERVER-SIDE value validation — client cannot bypass this
    const offerTotal = offeredCards.reduce((s: number, c: any) => s + Number(c.value), 0);
    const receiveTotal = receiveCards.reduce((s: number, c: any) => s + Number(c.estimatedValue), 0);

    if (receiveTotal > offerTotal + 0.001) { // small float tolerance
      return c.json({
        error: `Cannot receive more than offered. Offer: $${offerTotal.toFixed(2)}, Receive: $${receiveTotal.toFixed(2)}`
      }, 400);
    }

    const refund = Math.max(0, offerTotal - receiveTotal);

    // 5. Remove offered cards in a single batch operation
    await blink.db.inventory.deleteMany({ where: { id: { in: offerInventoryIds } } });

    // 6. Add received cards
    const addedCards: any[] = [];
    const isBot = user.isBot === true || Number(user.is_bot || 0) > 0;
    const recipientId = getRewardUserId(userId, isBot);
    for (const pc of receiveCards) {
      const newInvId = `inv_${uid()}`;
      const newCard = {
        id: newInvId,
        userId: recipientId,
        cardId: pc.id,
        cardName: pc.cardName,
        rarity: pc.rarity,
        value: Number(pc.estimatedValue),
        emoji: RARITY_EMOJIS[pc.rarity] || '🃏',
        isFavorite: 0,
        cardImageUrl: pc.cardImageUrl || null,
        packName: null,
      };
      await blink.db.inventory.create(newCard);
      addedCards.push({
        ...newCard,
        name: pc.cardName,
        isLocked: false,
      });
    }

    // 7. Refund difference to balance
    let newBalance = currentBalance;
    if (refund > 0.01) {
      const refundTargetId = getRewardUserId(userId, isBot);

      const walletResult = await processWalletTransaction(blink, {
        userId: refundTargetId,
        type: 'exchange_refund',
        amount: refund,
        sourceId: offerInventoryIds.join(',').slice(0, 100),
      });

      if (walletResult.success) {
        newBalance = refundTargetId === userId ? walletResult.balanceAfter : currentBalance;
      }

      await blink.db.transactions.create({
        id: `txn_${uid()}`,
        userId: refundTargetId,
        type: 'exchange_refund',
        amount: refund,
        description: `Exchange refund — traded ${offerTotal.toFixed(2)} for ${receiveTotal.toFixed(2)} in cards`,
      });
    }

    // 8. Log exchange transaction
    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'exchange',
      amount: -offerTotal,
      description: `Exchanged ${offeredCards.length} card(s) for ${receiveCards.length} card(s)`,
    });

    // Write activity log (non-critical)
    try {
      const username = user.username || user.displayName || 'Trainer';
      await writeLog(blink, {
        type: 'exchange',
        userId,
        username,
        action: 'Card Exchange',
        details: {
          offeredCards: offeredCards.map((c: any) => ({ name: c.cardName, value: Number(c.value), rarity: c.rarity })),
          receivedCards: receiveCards.map((c: any) => ({ name: c.cardName, value: Number(c.estimatedValue), rarity: c.rarity })),
          offerTotal,
          receiveTotal,
          refund,
        },
        valueIn: offerTotal,
        valueOut: receiveTotal,
        result: 'success',
      });
    } catch { /* non-critical */ }

    return c.json({
      success: true,
      removedCardIds: offerInventoryIds,
      addedCards,
      refund,
      newBalance,
    });

  } catch (err: any) {
    console.error('[exchanger/trade] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;