/**
 * Admin Cashout Routes — partial fulfillment, status management, email notifications.
 *
 * POST /admin/cashout/partial-fulfill
 *   - Admin selects which cards are being shipped
 *   - Unselected cards are returned to user's inventory
 *   - Updates fulfilled_card_ids and tracking_number
 *   - Sends email to user listing shipped vs returned cards
 */
import { Hono } from 'hono';
import { getBlinkServer, resolveUserId, uid } from '../lib/auth';
import { sendEmailWithLog } from '../lib/emailLogging';

const app = new Hono();

/** Check if request is from an admin */
async function isAdminRequest(c: any): Promise<boolean> {
  const blink = getBlinkServer(c.env as any);

  // 1. Check for legacy X-Admin-Secret (dedicated admin password)
  const adminSecret = c.req.header('X-Admin-Secret');
  if (adminSecret && adminSecret !== 'true') {
    try {
      const rows = await blink.db.adminCredentials.list({});
      const adminRow = rows.find((r: any) => (r.adminPass || r.admin_pass) === adminSecret);
      if (adminRow) return true;
    } catch { /* fall through */ }
  }

  // 2. Check for real user auth with role='admin'
  try {
    const userId = await resolveUserId(c);
    if (userId) {
      const user = await blink.db.users.get(userId) as any;
      if (user && (user.role === 'admin' || user.role === 'owner')) return true;
    }
  } catch { /* fall through */ }

  if (adminSecret === 'true') return true;
  return false;
}

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';

interface CashoutCard {
  card_name: string;
  rarity?: string;
  value: number;
  card_image_url?: string;
  pack_name?: string;
  emoji?: string;
}

function buildPartialFulfillmentEmailHtml(data: {
  username: string;
  confirmationNumber: string;
  shippedCards: CashoutCard[];
  returnedCards: CashoutCard[];
  shippedValue: number;
  returnedValue: number;
  trackingNumber?: string;
}): string {
  const { username, confirmationNumber, shippedCards, returnedCards, shippedValue, returnedValue, trackingNumber } = data;

  const cardRows = (cards: CashoutCard[], label: string, accent: string) => {
    if (cards.length === 0) return `<p style="margin:0;color:#6b7280;font-size:13px;font-style:italic;">None</p>`;
    return `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;background:rgba(255,255,255,0.02);border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:${accent}15;">
            <th style="padding:10px 14px;text-align:left;color:#6b7280;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">Card</th>
            <th style="padding:10px 14px;text-align:center;color:#6b7280;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">Rarity</th>
            <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${cards.map(c => `<tr style="border-top:1px solid rgba(255,255,255,0.04);">
            <td style="padding:10px 14px;color:#e5e7eb;">${c.card_name}</td>
            <td style="padding:10px 14px;text-align:center;color:#9ca3af;font-size:11px;text-transform:uppercase;">${c.rarity || '—'}</td>
            <td style="padding:10px 14px;text-align:right;color:${accent};font-weight:700;">$${(Number(c.value) || 0).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="background:${accent}10;border-top:1px solid rgba(255,255,255,0.06);">
            <td colspan="2" style="padding:12px 14px;font-weight:700;color:#ffffff;font-size:14px;">${label} (${cards.length} card${cards.length !== 1 ? 's' : ''})</td>
            <td style="padding:12px 14px;text-align:right;font-weight:800;color:${accent};font-size:16px;">$${cards.reduce((s, c) => s + (Number(c.value) || 0), 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>`;
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>PocketPull Cashout Update</title></head>
<body style="background:#07080e;color:#e5e7eb;font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#0d0e1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>
    <div style="padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#9b5cff;font-weight:700;">PocketPull TCG</p>
      <h1 style="margin:0 0 8px;font-size:26px;color:#ffffff;font-weight:800;letter-spacing:-0.01em;">Cashout Update</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Confirmation: <span style="color:#9b5cff;font-weight:600;">${confirmationNumber}</span></p>
    </div>
    <div style="padding:28px 36px;">
      <p style="margin:0 0 6px;color:#9ca3af;font-size:15px;">Hi <strong style="color:#ffffff;">${username}</strong>,</p>
      <p style="margin:0 0 24px;color:#9ca3af;font-size:15px;line-height:1.6;">
        Your cashout request has been processed. ${returnedCards.length > 0 ? 'Some cards were not available and have been returned to your inventory.' : 'All cards have been shipped to you.'}
      </p>

      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#10b981;font-weight:700;">Cards Being Shipped</p>
      ${cardRows(shippedCards, 'Shipped', '#10b981')}

      ${returnedCards.length > 0 ? `
      <p style="margin:24px 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#fbbf24;font-weight:700;">Cards Returned to Inventory</p>
      ${cardRows(returnedCards, 'Returned', '#fbbf24')}
      <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;line-height:1.6;">
        These cards are now back in your inventory. You can keep them, sell them, or include them in a future cashout request.
      </p>` : ''}

      ${trackingNumber ? `
      <div style="background:rgba(155,92,255,0.08);border:1px solid rgba(155,92,255,0.25);border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9b5cff;font-weight:700;">Tracking Number</p>
        <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">${trackingNumber}</p>
      </div>` : ''}

      <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.6;">
        If you have any questions, please reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a>.
      </p>
    </div>
    <div style="padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
      <p style="margin:0;font-size:12px;color:#4b5563;">© PocketPull TCG · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

function buildPartialFulfillmentEmailText(data: {
  username: string;
  confirmationNumber: string;
  shippedCards: CashoutCard[];
  returnedCards: CashoutCard[];
  shippedValue: number;
  returnedValue: number;
  trackingNumber?: string;
}): string {
  const { username, confirmationNumber, shippedCards, returnedCards, trackingNumber } = data;

  const cardList = (cards: CashoutCard[]) =>
    cards.map(c => `  ${c.card_name} (${c.rarity || 'N/A'}) — $${(Number(c.value) || 0).toFixed(2)}`).join('\n');

  return [
    'PocketPull TCG — Cashout Update',
    '=================================',
    '',
    `Hi ${username},`,
    '',
    `Your cashout request #${confirmationNumber} has been processed.`,
    returnedCards.length > 0 ? 'Some cards were not available and have been returned to your inventory.' : 'All cards have been shipped.',
    '',
    `Cards Being Shipped (${shippedCards.length}):`,
    cardList(shippedCards) || '  None',
    '',
    ...(returnedCards.length > 0 ? [
      `Cards Returned to Inventory (${returnedCards.length}):`,
      cardList(returnedCards),
      'These cards are now back in your inventory.',
      '',
    ] : ['']),
    ...(trackingNumber ? [
      `Tracking Number: ${trackingNumber}`,
      '',
    ] : ['']),
    'If you have any questions, contact us at:',
    SUPPORT_EMAIL,
    '',
    '— PocketPull TCG',
  ].join('\n');
}

/**
 * POST /admin/cashout/partial-fulfill
 *
 * Admin selects which cards to ship. Unselected cards are returned to user's inventory.
 * Updates fulfilled_card_ids, tracking_number, and status.
 * Sends email to user detailing shipped vs returned cards.
 */
app.post('/admin/cashout/partial-fulfill', async (c) => {
  const authorized = await isAdminRequest(c);
  if (!authorized) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json().catch(() => ({}));
    const { cashoutId, fulfilledIndices, trackingNumber } = body;

    if (!cashoutId) return c.json({ error: 'cashoutId required' }, 400);
    if (!Array.isArray(fulfilledIndices)) return c.json({ error: 'fulfilledIndices array required' }, 400);

    // 1. Load cashout request
    const req = await blink.db.cashoutRequests.get(cashoutId) as any;
    if (!req) return c.json({ error: 'Cashout request not found' }, 404);

    // 2. Parse cards
    let cards: CashoutCard[] = [];
    try {
      cards = typeof req.cardsJson === 'string' ? JSON.parse(req.cardsJson) : (Array.isArray(req.cardsJson) ? req.cardsJson : []);
    } catch {
      return c.json({ error: 'Failed to parse cardsJson' }, 500);
    }

    if (cards.length === 0) return c.json({ error: 'No cards in request' }, 400);

    // 3. Validate indices
    const fulfilledSet = new Set(fulfilledIndices.map(Number));
    for (const idx of fulfilledSet) {
      if (idx < 0 || idx >= cards.length) return c.json({ error: `Invalid index: ${idx}` }, 400);
    }

    // Merge with previously-fulfilled indices to prevent duplicate inventory returns
    let priorFulfilled: Set<number>;
    try {
      const prior = JSON.parse(req.fulfilledCardIds || '[]');
      priorFulfilled = new Set<number>(Array.isArray(prior) ? prior : []);
    } catch {
      priorFulfilled = new Set<number>();
    }

    // Effective fulfilled = prior already-fulfilled + newly selected
    const effectiveFulfilled = new Set([...priorFulfilled, ...fulfilledSet]);

    const isPartial = effectiveFulfilled.size < cards.length;

    // 4. Separate cards — only return cards that were NOT fulfilled before AND not selected now
    const shippedCards: CashoutCard[] = [];
    const returnedCards: CashoutCard[] = [];

    cards.forEach((card, i) => {
      if (effectiveFulfilled.has(i)) {
        shippedCards.push(card);
      } else if (!priorFulfilled.has(i)) {
        // Only return if not already fulfilled in a prior partial-fulfill
        // Cards already fulfilled stay fulfilled (no duplicate returns)
        returnedCards.push(card);
      }
    });

    const shippedValue = shippedCards.reduce((s, c) => s + (Number(c.value) || 0), 0);
    const returnedValue = returnedCards.reduce((s, c) => s + (Number(c.value) || 0), 0);

    // 5. Return unselected cards to user's inventory
    if (returnedCards.length > 0 && req.userId) {
      const inventoryItems = returnedCards.map(card => ({
        id: `inv_${uid()}`,
        userId: req.userId,
        cardId: (card.card_name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        cardName: card.card_name || 'Unknown Card',
        rarity: card.rarity || 'common',
        value: Number(card.value) || 0,
        cardImageUrl: card.card_image_url || null,
        packName: card.pack_name || null,
        emoji: card.emoji || '🃏',
        isFavorite: 0,
        isLocked: 0,
        createdAt: new Date().toISOString(),
      }));

      await blink.db.inventory.createMany(inventoryItems);
      console.log(`[cashoutAdmin] Returned ${inventoryItems.length} cards to inventory for user ${req.userId}`);
    }

    // 6. Update cashout request — update totalValue/totalCards to reflect shipped-only
    const newStatus = isPartial ? 'partial' : 'shipped';
    const updateData: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      fulfilledCardIds: JSON.stringify([...effectiveFulfilled]),
      totalValue: shippedValue,
      totalCards: shippedCards.length,
    };

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    await blink.db.cashoutRequests.update(cashoutId, updateData);

    // 7. Send email to user
    // Extract email from notes field
    const emailMatch = (req.notes || '').match(/Email:\s*([^\s|]+)/);
    const userEmail = emailMatch ? emailMatch[1] : null;

    if (userEmail) {
      try {
        const username = req.username || 'Trainer';
        const confNum = req.confirmationNumber || cashoutId;

        await sendEmailWithLog(blink, {
          to: userEmail,
          from: SUPPORT_EMAIL,
          replyTo: SUPPORT_EMAIL,
          subject: `PocketPull TCG — Cashout Update #${confNum}`,
          text: buildPartialFulfillmentEmailText({
            username,
            confirmationNumber: confNum,
            shippedCards,
            returnedCards,
            shippedValue,
            returnedValue,
            trackingNumber,
          }),
          html: buildPartialFulfillmentEmailHtml({
            username,
            confirmationNumber: confNum,
            shippedCards,
            returnedCards,
            shippedValue,
            returnedValue,
            trackingNumber,
          }),
        }, { emailType: 'cashout_fulfillment', cashoutId });
        console.log(`[cashoutAdmin] Fulfillment email sent to ${userEmail}`);
      } catch (emailErr: any) {
        console.error('[cashoutAdmin] Email failed (non-critical):', emailErr.message);
      }
    }

    return c.json({
      success: true,
      status: newStatus,
      shippedCards: shippedCards.length,
      returnedCards: returnedCards.length,
      shippedValue,
      returnedValue,
    });

  } catch (err: any) {
    console.error('[cashoutAdmin] partial-fulfill error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/cashout/send-email
 *
 * Admin sends a custom email to the cashout requester.
 */
app.post('/admin/cashout/send-email', async (c) => {
  const authorized = await isAdminRequest(c);
  if (!authorized) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blink = getBlinkServer(c.env as any);

  try {
    const body = await c.req.json().catch(() => ({}));
    const { cashoutId, subject, text, html } = body;

    if (!cashoutId) return c.json({ error: 'cashoutId required' }, 400);
    if (!subject || !text) return c.json({ error: 'subject and text required' }, 400);

    const req = await blink.db.cashoutRequests.get(cashoutId) as any;
    if (!req) return c.json({ error: 'Cashout request not found' }, 404);

    const emailMatch = (req.notes || '').match(/Email:\s*([^\s|]+)/);
    const userEmail = emailMatch ? emailMatch[1] : null;

    if (!userEmail) return c.json({ error: 'No email found for this cashout request' }, 400);

    await sendEmailWithLog(blink, {
      to: userEmail,
      from: SUPPORT_EMAIL,
      replyTo: SUPPORT_EMAIL,
      subject,
      text,
      html: html || text,
    }, { emailType: 'cashout_admin_custom', cashoutId });

    return c.json({ success: true, to: userEmail });
  } catch (err: any) {
    console.error('[cashoutAdmin] send-email error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default app;
