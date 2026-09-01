/**
 * Inventory Routes — secure card state mutations.
 *
 * Lock/favorite/sell/sell-all use PostgreSQL on the migration branch.
 * Authentication remains on the existing auth bridge until auth migration is complete.
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../lib/auth';
import { writeLog } from './logs';
import {
  getInventoryCard,
  updateInventoryFlags,
  sellInventoryCard,
  sellAllUnlockedInventory,
} from '../db/repositories/inventory';

const app = new Hono();

async function authenticatedUser(c: any): Promise<string> {
  try {
    return await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') throw new Error('ACCOUNT_DEACTIVATED');
    throw new Error('AUTHENTICATION_REQUIRED');
  }
}

app.post('/inventory/lock', async (c) => {
  let userId: string;
  try { userId = await authenticatedUser(c); }
  catch (err: any) { return c.json({ error: err.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }

  try {
    const { inventoryId, isLocked } = await c.req.json();
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

app.post('/inventory/favorite', async (c) => {
  let userId: string;
  try { userId = await authenticatedUser(c); }
  catch (err: any) { return c.json({ error: err.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }

  try {
    const { inventoryId, isFavorite } = await c.req.json();
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

app.post('/inventory/sell', async (c) => {
  let userId: string;
  try { userId = await authenticatedUser(c); }
  catch (err: any) { return c.json({ error: err.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }

  try {
    const { inventoryId } = await c.req.json();
    if (!inventoryId) return c.json({ error: 'inventoryId required' }, 400);

    const result = await sellInventoryCard(c.env as any, inventoryId, userId);
    try {
      const blink = getBlinkServer(c.env as any);
      await writeLog(blink, {
        type: 'sell', userId, username: 'Trainer', action: 'Sold Card',
        details: { cardName: result.card.cardName, rarity: result.card.rarity, value: result.card.value, cardImageUrl: result.card.cardImageUrl || '', packName: result.card.packName || '' },
        valueIn: result.card.value, valueOut: 0, result: 'sold',
      });
    } catch {}

    return c.json({ success: true, newBalance: result.newBalance, soldCardId: inventoryId, cardValue: result.card.value });
  } catch (err: any) {
    const status = err.message === 'Card not found' ? 404 : err.message?.includes('locked') ? 400 : err.message === 'Account deactivated' ? 403 : err.message === 'Account banned' ? 403 : 500;
    console.error('[inventory/sell] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, status);
  }
});

app.post('/inventory/sell-all', async (c) => {
  let userId: string;
  try { userId = await authenticatedUser(c); }
  catch (err: any) { return c.json({ error: err.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }

  try {
    const result = await sellAllUnlockedInventory(c.env as any, userId);
    try {
      const blink = getBlinkServer(c.env as any);
      await writeLog(blink, {
        type: 'sell', userId, username: 'Trainer', action: `Sold All Cards (${result.cards.length})`,
        details: { totalCards: result.cards.length, totalValue: result.totalValue, cards: result.cards.slice(0, 20).map(card => ({ name: card.cardName, value: card.value, rarity: card.rarity, cardImageUrl: card.cardImageUrl || '', packName: card.packName || '' })) },
        valueIn: result.totalValue, valueOut: 0, result: 'sold_all',
      });
    } catch {}

    return c.json({ success: true, newBalance: result.newBalance, soldCardIds: result.cards.map(card => card.id), totalValue: result.totalValue, count: result.cards.length });
  } catch (err: any) {
    const status = err.message === 'No unlocked cards to sell' ? 400 : err.message === 'Account deactivated' || err.message === 'Account banned' ? 403 : 500;
    console.error('[inventory/sell-all] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, status);
  }
});

export default app;
