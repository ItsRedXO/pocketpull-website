import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid } from '../lib/auth';
import { createCashout } from '../db/repositories/cashout';
import { writeLog } from './logs';
import { sendEmailWithLog } from '../lib/emailLogging';
import { getDb } from '../db/client';

const app = new Hono();
const MIN_VALUE = 25;
const MAX_CARDS = 25;

app.post('/cashout/submit', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    if (err.message === 'ACCOUNT_DEACTIVATED' || err.message === 'ACCOUNT_BANNED') return c.json({ error: 'Account deactivated' }, 403);
    return c.json({ error: 'Authentication required' }, 401);
  }
  try {
    const body = await c.req.json();
    const inventoryIds = Array.isArray(body.inventoryIds) ? [...new Set(body.inventoryIds.map(String))] : [];
    const shipping = body.shipping;
    if (!inventoryIds.length) return c.json({ error: 'inventoryIds required' }, 400);
    if (inventoryIds.length > MAX_CARDS) return c.json({ error: `Maximum ${MAX_CARDS} cards per cashout request` }, 400);
    if (!shipping?.name || !shipping?.address || !shipping?.city || !shipping?.state || !shipping?.zip) return c.json({ error: 'Incomplete shipping information' }, 400);
    if (!body.idImageUrl) return c.json({ error: 'ID verification image required' }, 400);
    const candidate = await getDb(c.env as any).query<{ total: string; count: string }>(`SELECT COALESCE(SUM(value),0)::text AS total, COUNT(*)::text AS count FROM inventory WHERE id=ANY($1::text[]) AND user_id=$2 AND is_locked=FALSE`, [inventoryIds, userId]);
    if (Number(candidate.rows[0]?.count || 0) !== inventoryIds.length) return c.json({ error: 'One or more selected cards are not in your inventory or are locked' }, 400);
    const candidateValue = Number(candidate.rows[0]?.total || 0);
    if (candidateValue < MIN_VALUE) return c.json({ error: `Minimum cashout value is $${MIN_VALUE.toFixed(2)}. Current: $${candidateValue.toFixed(2)}` }, 400);
    const confirmationNumber = `PP-${Date.now().toString(36).toUpperCase()}-${uid().slice(0,4).toUpperCase()}`;
    const result = await createCashout(c.env as any, { id: uid(), userId, cardIds: inventoryIds, confirmationNumber, shipping, idImageUrl: body.idImageUrl });
    const blink = getBlinkServer(c.env as any);
    if (result.email) {
      try { await sendEmailWithLog(blink, { to: result.email, from: 'support@pocketpulltcg.com', replyTo: 'support@pocketpulltcg.com', subject: `PocketPull TCG — Cashout Confirmation #${confirmationNumber}`, text: `Hi ${result.username},\n\nYour cashout request #${confirmationNumber} has been received.\n\nCards: ${result.cards.map(card => card.card_name).join(', ')}\nTotal Value: ${Number(result.request.total_value).toFixed(2)}\n\nWe will process your request within 3-5 business days.\n\nPocketPull TCG Team` }, { emailType: 'cashout_confirmation', cashoutId: result.request.id }); } catch (emailErr) { console.error('[cashout/submit] email error:', emailErr); }
    }
    await writeLog(blink, { type: 'cashout', userId, username: result.username, action: 'Cash Out Request Submitted', details: { confirmationNumber, totalCards: result.cards.length, totalValue: Number(result.request.total_value), status: 'pending' }, valueIn: 0, valueOut: Number(result.request.total_value), result: 'pending' });
    return c.json({ success: true, confirmationNumber, totalValue: Number(result.request.total_value), totalCards: result.cards.length, removedCardIds: inventoryIds });
  } catch (err: any) {
    console.error('[cashout/submit] error:', err?.message || err);
    const status = /not in your inventory|locked|Minimum cashout|Account deactivated|Account banned/.test(err?.message || '') ? 400 : 500;
    return c.json({ error: err?.message || 'Internal server error' }, status as any);
  }
});

export default app;
