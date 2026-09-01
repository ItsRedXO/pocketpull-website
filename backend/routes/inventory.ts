/**
 * Inventory Routes — secure card state mutations.
 *
 * Lock/favorite mutations use PostgreSQL on the migration branch. Sell paths
 * remain on the legacy Blink layer until the atomic wallet cutover is complete.
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';
import { getInventoryCard, updateInventoryFlags } from '../db/repositories/inventory';

const app = new Hono();

async function authenticatedUser(c: any): Promise<string | null> {
  try {
    return await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return null;
    throw err;
  }
}

// POST /inventory/lock
app.post('/inventory/lock', async (c) => {
  let userId: string;
  try {
    userId = await authenticatedUser(c) as string;
    if (!userId) return c.json({ error: 'Account deactivated' }, 403);
  } catch {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { inventoryId, isLocked } = body;
    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);
    if (typeof isLocked !== 'boolean') return c.json({ error: 'isLocked (boolean) required' }, 400);

    const card = await getInventoryCard(c.env as any, inventoryId);
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);

    const updated = await updateInventoryFlags(c.env as any, inventoryId, userId, { isLocked });
    if (!updated) return c.json({ error: 'Card not found' }, 404);
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
    userId = await authenticatedUser(c) as string;
    if (!userId) return c.json({ error: 'Account deactivated' }, 403);
  } catch {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { inventoryId, isFavorite } = body;
    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);
    if (typeof isFavorite !== 'boolean') return c.json({ error: 'isFavorite (boolean) required' }, 400);

    const card = await getInventoryCard(c.env as any, inventoryId);
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);

    const updated = await updateInventoryFlags(c.env as any, inventoryId, userId, { isFavorite });
    if (!updated) return c.json({ error: 'Card not found' }, 404);
    return c.json({ success: true, inventoryId, isFavorite });
  } catch (err: any) {
    console.error('[inventory/favorite] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /inventory/sell — legacy until atomic PostgreSQL wallet cutover
app.post('/inventory/sell', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json();
    const { inventoryId } = body;
    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);
    const card = await blink.db.inventory.get(inventoryId) as any;
    if (!card) return c.json({ error: 'Card not found' }, 404);
    if (card.userId !== userId) return c.json({ error: 'Not your card' }, 403);
    if (Number(card.isLocked) > 0) return c.json({ error: 'Card is locked and cannot be sold' }, 400);
    const cardValue = Number(card.value);
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    await blink.db.inventory.delete(inventoryId);
    const walletResult = await processWalletTransaction(blink, { userId, type: 'sell', amount: cardValue, sourceId: inventoryId });
    if (!walletResult.success) return c.json({ error: walletResult.error || 'Failed to credit balance' }, 500);
    const newBalance = walletResult.balanceAfter;
    await blink.db.transactions.create({ id: `txn_${uid()}`, userId, type: 'sell', amount: cardValue, description: `Sold ${card.cardName} from inventory |img:${card.cardImageUrl || ''}|` });
    try {
      const username = user.username || user.displayName || 'Trainer';
      await writeLog(blink, { type: 'sell', userId, username, action: 'Sold Card', details: { cardName: card.cardName, rarity: card.rarity, value: cardValue, cardImageUrl: card.cardImageUrl || '', packName: card.packName || '' }, valueIn: cardValue, valueOut: 0, result: 'sold' });
    } catch {}
    return c.json({ success: true, newBalance, soldCardId: inventoryId, cardValue });
  } catch (err: any) {
    console.error('[inventory/sell] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /inventory/sell-all — legacy until atomic PostgreSQL wallet cutover
app.post('/inventory/sell-all', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
  const blink = getBlinkServer(c.env as any);
  try {
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    const allCards = await blink.db.inventory.list({ where: { userId } }) as any[];
    const sellable = allCards.filter((card: any) => !Number(card.isLocked));
    if (sellable.length === 0) return c.json({ error: 'No unlocked cards to sell' }, 400);
    const totalValue = sellable.reduce((sum: number, card: any) => sum + Number(card.value), 0);
    const soldIds = sellable.map((card: any) => card.id);
    await blink.db.inventory.deleteMany({ where: { id: { in: soldIds } } });
    const walletResult = await processWalletTransaction(blink, { userId, type: 'sell_all', amount: totalValue, sourceId: soldIds.join(',').slice(0, 100) });
    if (!walletResult.success) return c.json({ error: walletResult.error || 'Failed to credit balance' }, 500);
    const newBalance = walletResult.balanceAfter;
    const firstCard = sellable[0];
    await blink.db.transactions.create({ id: `txn_${uid()}`, userId, type: 'sell', amount: totalValue, description: `Sold all ${sellable.length} unlocked card(s) from inventory |img:${firstCard?.cardImageUrl || ''}|` });
    try {
      const username = user.username || user.displayName || 'Trainer';
      await writeLog(blink, { type: 'sell', userId, username, action: `Sold All Cards (${sellable.length})`, details: { totalCards: sellable.length, totalValue, cards: sellable.slice(0, 20).map((card: any) => ({ name: card.cardName, value: Number(card.value), rarity: card.rarity, cardImageUrl: card.cardImageUrl || '', packName: card.packName || '' })) }, valueIn: totalValue, valueOut: 0, result: 'sold_all' });
    } catch {}
    return c.json({ success: true, newBalance, soldCardIds: soldIds, totalValue, count: sellable.length });
  } catch (err: any) {
    console.error('[inventory/sell-all] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
