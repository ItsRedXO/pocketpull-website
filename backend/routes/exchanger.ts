import { Hono } from 'hono';
import { requireAuth, uid, getRewardUserId, getBlinkServer } from '../lib/auth';
import { transaction } from '../lib/postgres';
import { processWalletTransactionInClient } from '../repositories/wallet';
import { writeLog } from './logs';

const app = new Hono();

const RARITY_EMOJIS: Record<string, string> = {
  common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈',
};

app.post('/exchanger/trade', async (c) => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const { offerInventoryIds, receivePackCardIds } = body;
    if (!Array.isArray(offerInventoryIds) || offerInventoryIds.length === 0) return c.json({ error: 'offerInventoryIds required' }, 400);
    if (!Array.isArray(receivePackCardIds) || receivePackCardIds.length === 0) return c.json({ error: 'receivePackCardIds required' }, 400);
    if (offerInventoryIds.length > 100 || receivePackCardIds.length > 100) return c.json({ error: 'Too many cards in one exchange' }, 400);
    if (new Set(offerInventoryIds).size !== offerInventoryIds.length || new Set(receivePackCardIds).size !== receivePackCardIds.length) return c.json({ error: 'Duplicate cards are not allowed' }, 400);

    const result = await transaction(async client => {
      const userRows = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId]);
      if (!userRows.rowCount) return { kind: 'user_not_found' as const };
      const user = userRows.rows[0] as any;
      if (Number(user.is_deleted || 0) > 0) return { kind: 'deactivated' as const };
      if (Number(user.is_banned || 0) > 0) return { kind: 'banned' as const };

      const placeholders = offerInventoryIds.map((_: unknown, i: number) => `$${i + 2}`).join(',');
      const offeredRows = await client.query(`SELECT * FROM inventory WHERE user_id=$1 AND id IN (${placeholders}) FOR UPDATE`, [userId, ...offerInventoryIds]);
      if (offeredRows.rowCount !== offerInventoryIds.length) return { kind: 'invalid_offer' as const };
      const offeredById = new Map(offeredRows.rows.map((row: any) => [row.id, row]));
      const offeredCards = offerInventoryIds.map((id: string) => offeredById.get(id) as any);
      for (const card of offeredCards) {
        if (Number(card.sold || 0) > 0) return { kind: 'already_sold' as const };
        if (Number(card.is_locked ?? card.locked ?? 0) > 0) return { kind: 'locked' as const };
      }

      const receivePlaceholders = receivePackCardIds.map((_: unknown, i: number) => `$${i + 1}`).join(',');
      const receiveRows = await client.query(`SELECT * FROM pack_cards WHERE id IN (${receivePlaceholders})`, receivePackCardIds);
      if (receiveRows.rowCount !== receivePackCardIds.length) return { kind: 'invalid_receive' as const };
      const receiveById = new Map(receiveRows.rows.map((row: any) => [row.id, row]));
      const receiveCards = receivePackCardIds.map((id: string) => receiveById.get(id) as any);

      const offerTotal = offeredCards.reduce((sum: number, card: any) => sum + Number(card.value || 0), 0);
      const receiveTotal = receiveCards.reduce((sum: number, card: any) => sum + Number(card.estimated_value ?? card.value ?? 0), 0);
      if (receiveTotal > offerTotal + 0.001) return { kind: 'value_exceeded' as const, offerTotal, receiveTotal };

      const refund = Math.max(0, offerTotal - receiveTotal);
      const isBot = Number(user.is_bot || 0) > 0;
      const recipientId = getRewardUserId(userId, isBot);

      await client.query(`UPDATE inventory SET sold=1 WHERE user_id=$1 AND id IN (${placeholders}) AND sold=0`, [userId, ...offerInventoryIds]);

      const addedCards: any[] = [];
      for (const pc of receiveCards) {
        const newInvId = `inv_${uid()}`;
        await client.query(`INSERT INTO inventory (id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,card_image_url,pack_name,sold,locked,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,0,now())`,
          [newInvId, recipientId, pc.id, pc.card_name, pc.rarity, Number(pc.estimated_value ?? pc.value ?? 0), RARITY_EMOJIS[pc.rarity] || '🃏', pc.card_image_url || pc.image_url || null, null]);
        addedCards.push({ id: newInvId, userId: recipientId, cardId: pc.id, cardName: pc.card_name, rarity: pc.rarity, value: Number(pc.estimated_value ?? pc.value ?? 0), emoji: RARITY_EMOJIS[pc.rarity] || '🃏', cardImageUrl: pc.card_image_url || pc.image_url || null, packName: null, isLocked: false });
      }

      let newBalance = Number(user.balance || 0);
      if (refund > 0.01) {
        const refundSourceId = `exchange_refund_${offerInventoryIds.slice().sort().join('_')}`;
        const wallet = await processWalletTransactionInClient(client, { userId: recipientId, type: 'exchange_refund', amount: refund, sourceId: refundSourceId.slice(0, 255), metadata: { offerTotal, receiveTotal, offerInventoryIds, receivePackCardIds } });
        if (!wallet.success) throw new Error(wallet.error || 'Failed to credit exchange refund');
        if (recipientId === userId) newBalance = wallet.balanceAfter;
        await client.query(`INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
          [`txn_exchange_refund_${uid()}`, recipientId, 'exchange_refund', refund, `Exchange refund — traded ${offerTotal.toFixed(2)} for ${receiveTotal.toFixed(2)} in cards`, refundSourceId.slice(0, 255)]);
      }

      const exchangeSourceId = `exchange_${offerInventoryIds.slice().sort().join('_')}_${receivePackCardIds.slice().sort().join('_')}`.slice(0, 255);
      await client.query(`INSERT INTO transactions(id,user_id,type,amount,description,source_id,created_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
        [`txn_exchange_${uid()}`, userId, 'exchange', -offerTotal, `Exchanged ${offeredCards.length} card(s) for ${receiveCards.length} card(s)`, exchangeSourceId]);

      return { kind: 'ok' as const, removedCardIds: offerInventoryIds, addedCards, refund, newBalance, offerTotal, receiveTotal, offeredCards, receiveCards, username: user.username || user.display_name || 'Trainer' };
    });

    if (result.kind === 'user_not_found') return c.json({ error: 'User not found' }, 404);
    if (result.kind === 'deactivated') return c.json({ error: 'Account deactivated' }, 403);
    if (result.kind === 'banned') return c.json({ error: 'Account banned' }, 403);
    if (result.kind === 'invalid_offer') return c.json({ error: 'One or more cards are not in your inventory' }, 400);
    if (result.kind === 'already_sold') return c.json({ error: 'One or more cards were already sold' }, 409);
    if (result.kind === 'locked') return c.json({ error: 'One or more cards are locked' }, 400);
    if (result.kind === 'invalid_receive') return c.json({ error: 'One or more market cards were not found' }, 400);
    if (result.kind === 'value_exceeded') return c.json({ error: `Cannot receive more than offered. Offer: $${result.offerTotal.toFixed(2)}, Receive: $${result.receiveTotal.toFixed(2)}` }, 400);

    try {
      await writeLog(getBlinkServer(c.env as any), {
        type: 'exchange', userId, username: result.username, action: 'Card Exchange',
        details: {
          offeredCards: result.offeredCards.map((card: any) => ({ name: card.card_name, value: Number(card.value || 0), rarity: card.rarity })),
          receivedCards: result.receiveCards.map((card: any) => ({ name: card.card_name, value: Number(card.estimated_value ?? card.value ?? 0), rarity: card.rarity })),
          offerTotal: result.offerTotal, receiveTotal: result.receiveTotal, refund: result.refund,
        },
        valueIn: result.offerTotal, valueOut: result.receiveTotal, result: 'success',
      });
    } catch { /* non-critical */ }

    return c.json({ success: true, removedCardIds: result.removedCardIds, addedCards: result.addedCards, refund: result.refund, newBalance: result.newBalance });
  } catch (err: any) {
    console.error('[exchanger/trade] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
