import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { transaction } from '../lib/postgres';
import { writeLog } from './logs';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();
const MIN_VALUE = 25;
const MAX_CARDS = 25;

app.post('/cashout/submit', async c => {
  let userId: string;
  try {
    userId = await requireAuth(c);
  } catch (error: any) {
    return c.json({ error: error?.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, 403);
  }

  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json().catch(() => ({}));
    const { inventoryIds, shipping, idImageUrl } = body;
    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) return c.json({ error: 'inventoryIds required' }, 400);
    if (inventoryIds.length > MAX_CARDS) return c.json({ error: `Maximum ${MAX_CARDS} cards per cashout request` }, 400);
    if (new Set(inventoryIds).size !== inventoryIds.length) return c.json({ error: 'Duplicate cards are not allowed' }, 400);
    if (!shipping?.name || !shipping?.address || !shipping?.city || !shipping?.state || !shipping?.zip) return c.json({ error: 'Incomplete shipping information' }, 400);
    if (!idImageUrl) return c.json({ error: 'ID verification image required' }, 400);

    const result = await transaction(async client => {
      const userRows = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId]);
      const user = userRows.rows[0] as any;
      if (!user) return { kind: 'user_not_found' as const };
      if (Number(user.is_deleted || 0) > 0) return { kind: 'deactivated' as const };
      if (Number(user.is_banned || 0) > 0) return { kind: 'banned' as const };

      const placeholders = inventoryIds.map((_: unknown, i: number) => `$${i + 2}`).join(',');
      const rows = await client.query(
        `SELECT * FROM inventory WHERE user_id=$1 AND id IN (${placeholders}) FOR UPDATE`,
        [userId, ...inventoryIds],
      );
      if (rows.rowCount !== inventoryIds.length) return { kind: 'invalid_cards' as const };

      const byId = new Map(rows.rows.map((row: any) => [row.id, row]));
      const selectedCards = inventoryIds.map((id: string) => byId.get(id) as any);
      for (const card of selectedCards) {
        if (Number(card.sold || 0) > 0) return { kind: 'already_sold' as const };
        if (Number(card.is_locked ?? card.locked ?? 0) > 0) return { kind: 'locked' as const };
      }

      const totalValue = selectedCards.reduce((sum: number, card: any) => sum + Number(card.value || 0), 0);
      if (totalValue < MIN_VALUE) return { kind: 'below_minimum' as const, totalValue };

      const confNum = `PP-${Date.now().toString(36).toUpperCase()}-${uid().slice(0, 4).toUpperCase()}`;
      const cashoutId = `cashout_${uid()}`;
      const cardsJson = JSON.stringify(selectedCards.map((card: any) => ({
        inventory_id: card.id,
        card_id: card.card_id,
        card_name: card.card_name,
        rarity: card.rarity,
        value: Number(card.value || 0),
        card_image_url: card.card_image_url || card.image_url || '',
        pack_name: card.pack_name || '',
        emoji: card.emoji || '🃏',
      })));
      const notes = `Email: ${shipping.email || ''} | Phone: ${shipping.phone || ''}`;

      await client.query(
        `INSERT INTO cashout_requests
          (id,user_id,username,confirmation_number,status,total_value,total_cards,cards_json,
           shipping_name,shipping_address,shipping_city,shipping_state,shipping_zip,shipping_country,
           notes,id_image_url,created_at,updated_at)
         VALUES($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,'US',$13,$14,now(),now())`,
        [cashoutId, userId, user.username || user.display_name || 'Trainer', confNum, totalValue, selectedCards.length, cardsJson,
          shipping.name, shipping.address, shipping.city, shipping.state, shipping.zip, notes, idImageUrl],
      );
      await client.query(`UPDATE inventory SET sold=1 WHERE user_id=$1 AND id IN (${placeholders}) AND sold=0`, [userId, ...inventoryIds]);

      return { kind: 'ok' as const, username: user.username || user.display_name || 'Trainer', confNum, cashoutId, selectedCards, totalValue };
    });

    if (result.kind === 'user_not_found') return c.json({ error: 'User not found' }, 404);
    if (result.kind === 'deactivated') return c.json({ error: 'Account deactivated' }, 403);
    if (result.kind === 'banned') return c.json({ error: 'Account banned' }, 403);
    if (result.kind === 'invalid_cards') return c.json({ error: 'One or more cards are not in your inventory' }, 400);
    if (result.kind === 'already_sold') return c.json({ error: 'One or more cards were already sold' }, 409);
    if (result.kind === 'locked') return c.json({ error: 'One or more cards are locked' }, 400);
    if (result.kind === 'below_minimum') return c.json({ error: `Minimum cashout value is $${MIN_VALUE.toFixed(2)}. Current: $${result.totalValue.toFixed(2)}` }, 400);

    const { username, confNum, cashoutId, selectedCards, totalValue } = result;
    if (shipping.email) {
      try {
        const summary = selectedCards.map((card: any) => card.card_name || 'Card').join(', ');
        await sendEmailWithLog(blink, {
          to: shipping.email,
          from: 'support@pocketpulltcg.com',
          replyTo: 'support@pocketpulltcg.com',
          subject: `PocketPull TCG — Cashout Confirmation #${confNum}`,
          text: `Hi ${username},\n\nYour cashout request #${confNum} has been received.\n\nCards: ${summary}\nTotal Value: $${totalValue.toFixed(2)}\n\nWe will process your request within 3-5 business days.\n\nPocketPull TCG Team`,
          html: `<p>Hi <strong>${username}</strong>,</p><p>Your cashout request <strong>#${confNum}</strong> has been received.</p><p><strong>Cards:</strong> ${summary}</p><p><strong>Total Value:</strong> $${totalValue.toFixed(2)}</p><p>We will process your request within 3-5 business days.</p>`,
        }, { emailType: 'cashout_confirmation', cashoutId });
      } catch (error) { console.error('[cashoutV2] email error:', error); }
    }

    try {
      await writeLog(blink, {
        type: 'cashout', userId, username, action: 'Cash Out Request Submitted',
        details: { confirmationNumber: confNum, totalCards: selectedCards.length, totalValue, cards: selectedCards.map((card: any) => ({ name: card.card_name, value: Number(card.value || 0), rarity: card.rarity })), shippingName: shipping.name, shippingCity: shipping.city, shippingState: shipping.state, status: 'pending' },
        valueIn: 0, valueOut: totalValue, result: 'pending',
      });
    } catch {}

    return c.json({ success: true, confirmationNumber: confNum, totalValue, totalCards: selectedCards.length, removedCardIds: inventoryIds });
  } catch (error: any) {
    console.error('[cashoutV2] error:', error?.message || error);
    return c.json({ error: error?.message || 'Internal server error' }, 500);
  }
});

export default app;
