/**
 * Cashout Routes — secure server-side validation for card shipment requests.
 *
 * POST /cashout/submit
 *   - Verifies auth
 *   - Validates cards belong to user and are not locked
 *   - Creates cashout_request record
 *   - Removes cards from inventory
 *   - Sends confirmation email
 */
import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { writeLog } from './logs';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();

const MIN_VALUE = 25;
const MAX_CARDS = 25;

app.post('/cashout/submit', async (c) => {
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
    const { inventoryIds, shipping, idImageUrl } = body;

    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return c.json({ error: 'inventoryIds required' }, 400);
    }
    if (inventoryIds.length > MAX_CARDS) {
      return c.json({ error: `Maximum ${MAX_CARDS} cards per cashout request` }, 400);
    }
    if (!shipping?.name || !shipping?.address || !shipping?.city || !shipping?.state || !shipping?.zip) {
      return c.json({ error: 'Incomplete shipping information' }, 400);
    }
    if (!idImageUrl) {
      return c.json({ error: 'ID verification image required' }, 400);
    }

    // Fetch user
    const user = await blink.db.users.get(userId) as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || user.is_deleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || user.is_banned || 0) > 0) return c.json({ error: 'Account banned' }, 403);

    const username = user.username || user.displayName || 'Trainer';

    // Verify cards belong to user and are not locked
    const userCards = await blink.db.inventory.list({ where: { userId } }) as any[];
    const userCardMap = Object.fromEntries(userCards.map((c: any) => [c.id, c]));

    const selectedCards: any[] = [];
    for (const invId of inventoryIds) {
      const card = userCardMap[invId];
      if (!card) return c.json({ error: `Card ${invId} not in your inventory` }, 400);
      if (Number(card.isLocked) > 0) return c.json({ error: `Card ${invId} is locked` }, 400);
      selectedCards.push(card);
    }

    const totalValue = selectedCards.reduce((s: number, c: any) => s + Number(c.value), 0);
    if (totalValue < MIN_VALUE) {
      return c.json({ error: `Minimum cashout value is $${MIN_VALUE.toFixed(2)}. Current: $${totalValue.toFixed(2)}` }, 400);
    }

    // Create confirmation number
    const confNum = `PP-${Date.now().toString(36).toUpperCase()}-${uid().slice(0, 4).toUpperCase()}`;

    // Create cashout record
    const cashoutId = uid();
    await blink.db.cashoutRequests.create({
      id: cashoutId,
      userId,
      username,
      confirmationNumber: confNum,
      status: 'pending',
      totalValue,
      totalCards: selectedCards.length,
      cardsJson: JSON.stringify(selectedCards.map((c: any) => ({
        card_id: c.cardId,
        card_name: c.cardName,
        rarity: c.rarity,
        value: Number(c.value),
        card_image_url: c.cardImageUrl || '',
        pack_name: c.packName || '',
        emoji: c.emoji || '🃏',
      }))),
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingZip: shipping.zip,
      shippingCountry: 'US',
      notes: `Email: ${shipping.email || ''} | Phone: ${shipping.phone || ''} | ID: ${idImageUrl}`,
      idImageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Remove cards from inventory
    for (const card of selectedCards) {
      await blink.db.inventory.delete(card.id);
    }

    // Send confirmation email (non-critical)
    if (shipping.email) {
      try {
        const cardSummary = selectedCards.map((c: any) => c.cardName).join(', ');
        await sendEmailWithLog(blink, {
          to: shipping.email,
          from: 'support@pocketpulltcg.com',
          replyTo: 'support@pocketpulltcg.com',
          subject: `PocketPull TCG — Cashout Confirmation #${confNum}`,
          text: `Hi ${username},\n\nYour cashout request #${confNum} has been received.\n\nCards: ${cardSummary}\nTotal Value: ${totalValue.toFixed(2)}\nShipping to: ${shipping.name}, ${shipping.address}, ${shipping.city}, ${shipping.state} ${shipping.zip}\n\nWe will process your request within 3-5 business days.\n\nThank you,\nPocketPull TCG Team\nsupport@pocketpulltcg.com`,
          html: `<p>Hi <strong>${username}</strong>,</p><p>Your cashout request <strong>#${confNum}</strong> has been received.</p><p><strong>Cards:</strong> ${cardSummary}</p><p><strong>Total Value:</strong> ${totalValue.toFixed(2)}</p><p><strong>Shipping to:</strong> ${shipping.name}, ${shipping.address}, ${shipping.city}, ${shipping.state} ${shipping.zip}</p><p>We will process your request within 3-5 business days.</p><p>Thank you,<br>PocketPull TCG Team<br><a href="mailto:support@pocketpulltcg.com">support@pocketpulltcg.com</a></p>`,
        }, { emailType: 'cashout_confirmation', cashoutId });
      } catch (emailErr) {
        console.error('[cashout/submit] email error (non-critical):', emailErr);
      }
    }

    // Write activity log (non-critical)
    try {
      await writeLog(blink, {
        type: 'cashout',
        userId,
        username,
        action: 'Cash Out Request Submitted',
        details: {
          confirmationNumber: confNum,
          totalCards: selectedCards.length,
          totalValue,
          cards: selectedCards.map((c: any) => ({ name: c.cardName, value: Number(c.value), rarity: c.rarity })),
          shippingName: shipping.name,
          shippingCity: shipping.city,
          shippingState: shipping.state,
          status: 'pending',
        },
        valueIn: 0,
        valueOut: totalValue,
        result: 'pending',
      });
    } catch { /* non-critical */ }

    return c.json({
      success: true,
      confirmationNumber: confNum,
      totalValue,
      totalCards: selectedCards.length,
      removedCardIds: inventoryIds,
    });

  } catch (err: any) {
    console.error('[cashout/submit] error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;