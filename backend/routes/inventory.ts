/**
 * Inventory Routes — secure card state mutations.
 *
 * POST /inventory/lock      - Lock/unlock a card (only owner can do this)
 * POST /inventory/favorite  - Toggle favorite on a card
 * POST /inventory/sell      - Sell a single card
 * POST /inventory/sell-all  - Sell all unlocked cards
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';

const app = new Hono();

// POST /inventory/lock
app.post('/inventory/lock', async (c) => {
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
    const { inventoryId, isLocked } = body;

    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);
    if (typeof isLocked !== 'boolean') return c.json({ error: 'isLocked (boolean) required' }, 400);

    // Verify ownership
    const card = await blink.db.inventory.get(inventoryId) as any;
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);

    await blink.db.inventory.update(inventoryId, { isLocked: isLocked ? 1 : 0 });

    return c.json({ success: true, inventoryId, isLocked });

  } catch (err: any) {
    console.error('[inventory/lock] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /inventory/favorite
app.post('/inventory/favorite', async (c) => {
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
    const { inventoryId, isFavorite } = body;

    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);
    if (typeof isFavorite !== 'boolean') return c.json({ error: 'isFavorite (boolean) required' }, 400);

    // Verify ownership
    const card = await blink.db.inventory.get(inventoryId) as any;
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);

    await blink.db.inventory.update(inventoryId, { isFavorite: isFavorite ? 1 : 0 });

    return c.json({ success: true, inventoryId, isFavorite });

  } catch (err: any) {
    console.error('[inventory/favorite] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /inventory/sell
app.post('/inventory/sell', async (c) => {
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
    const { inventoryId } = body;
    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);

    // Verify ownership and locked status
    const card = await blink.db.inventory.get(inventoryId) as any;
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);
    if (Number(card.isLocked) > 0) return c.json({ error: 'Card is locked and cannot be sold' }, 400);

    const cardValue = Number(card.value);

    // Fetch user for validation only
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    // Delete card first, then credit balance (wallet txn is idempotent)
    await blink.db.inventory.delete(inventoryId);

    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'sell',
      amount: cardValue,
      sourceId: inventoryId,
    });

    if (!walletResult.success) {
      return c.json({ error: walletResult.error || 'Failed to credit balance' }, 500);
    }

    const newBalance = walletResult.balanceAfter;

    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'sell',
      amount: cardValue,
      description: `Sold ${card.cardName} from inventory |img:${card.cardImageUrl || ''}|`,
    });

    // Write activity log (non-critical)
    try {
      const username = user.username || user.displayName || 'Trainer';
      await writeLog(blink, {
        type: 'sell',
        userId,
        username,
        action: 'Sold Card',
        details: {
          cardName: card.cardName,
          rarity: card.rarity,
          value: cardValue,
          cardImageUrl: card.cardImageUrl || '',
          packName: card.packName || '',
        },
        valueIn: cardValue,
        valueOut: 0,
        result: 'sold',
      });
    } catch { /* non-critical */ }

    return c.json({ success: true, newBalance, soldCardId: inventoryId, cardValue });

  } catch (err: any) {
    console.error('[inventory/sell] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /inventory/sell-all
app.post('/inventory/sell-all', async (c) => {
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
    // Fetch user
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    // Fetch all unlocked inventory cards
    const allCards = await blink.db.inventory.list({ where: { userId } }) as any[];
    const sellable = allCards.filter((c: any) => !Number(c.isLocked));

    if (sellable.length === 0) {
      return c.json({ error: 'No unlocked cards to sell' }, 400);
    }

    const totalValue = sellable.reduce((s: number, c: any) => s + Number(c.value), 0);
    const soldIds = sellable.map((c: any) => c.id);

    // Remove all unlocked cards in a single batch operation
    await blink.db.inventory.deleteMany({ where: { id: { in: soldIds } } });

    // Credit balance via wallet (idempotent)
    const sourceIdStr = soldIds.join(',').slice(0, 100);
    const walletResult = await processWalletTransaction(blink, {
      userId,
      type: 'sell_all',
      amount: totalValue,
      sourceId: sourceIdStr,
    });

    if (!walletResult.success) {
      return c.json({ error: walletResult.error || 'Failed to credit balance' }, 500);
    }

    const newBalance = walletResult.balanceAfter;

    // Log transaction
    const firstCard = sellable[0];
    await blink.db.transactions.create({
      id: `txn_${uid()}`,
      userId,
      type: 'sell',
      amount: totalValue,
      description: `Sold all ${sellable.length} unlocked card(s) from inventory |img:${firstCard?.cardImageUrl || ''}|`,
    });

    // Write activity log (non-critical)
    try {
      const username = user.username || user.displayName || 'Trainer';
      await writeLog(blink, {
        type: 'sell',
        userId,
        username,
        action: `Sold All Cards (${sellable.length})`,
        details: {
          totalCards: sellable.length,
          totalValue,
          cards: sellable.slice(0, 20).map((c: any) => ({
            name: c.cardName,
            value: Number(c.value),
            rarity: c.rarity,
            cardImageUrl: c.cardImageUrl || '',
            packName: c.packName || '',
          })),
        },
        valueIn: totalValue,
        valueOut: 0,
        result: 'sold_all',
      });
    } catch { /* non-critical */ }

    return c.json({ success: true, newBalance, soldCardIds: soldIds, totalValue, count: sellable.length });

  } catch (err: any) {
    console.error('[inventory/sell-all] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;