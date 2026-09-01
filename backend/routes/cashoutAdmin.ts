import { Hono } from 'hono';
import { requireAuth, getBlinkServer } from '../lib/auth';
import { getUserProfile } from '../db/repositories/users';
import { partialFulfillCashout } from '../db/repositories/cashout';
import { sendEmailWithLog } from '../lib/emailLogging';
import { writeLog } from './logs';

const app = new Hono();

app.post('/admin/cashout/partial-fulfill', async (c) => {
  let adminId: string;
  try { adminId = await requireAuth(c); } catch { return c.json({ error: 'Unauthorized' }, 401); }
  try {
    const admin = await getUserProfile(c.env as any, adminId);
    if (!admin || !['admin','owner'].includes(admin.role)) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    if (!body.cashoutId) return c.json({ error: 'cashoutId required' }, 400);
    if (!Array.isArray(body.fulfilledIndices)) return c.json({ error: 'fulfilledIndices array required' }, 400);
    const result = await partialFulfillCashout(c.env as any, { cashoutId: body.cashoutId, fulfilledIndices: body.fulfilledIndices, trackingNumber: body.trackingNumber });
    const user = await getUserProfile(c.env as any, result.request.user_id);
    const blink = getBlinkServer(c.env as any);
    if (user?.email) {
      try {
        const shipped = result.shippedCards.map(card => `- ${card.card_name} (${card.rarity || 'N/A'}) — $${Number(card.value).toFixed(2)}`).join('\n') || '- None';
        const returned = result.returnedCards.map(card => `- ${card.card_name} (${card.rarity || 'N/A'}) — $${Number(card.value).toFixed(2)}`).join('\n') || '- None';
        await sendEmailWithLog(blink, { to: user.email, from: 'support@pocketpulltcg.com', subject: `PocketPull TCG — Cashout Update #${result.request.confirmation_number}`, text: `Hi ${user.username || user.displayName || 'Trainer'},\n\nYour cashout has been updated.\n\nShipped:\n${shipped}\n\nReturned to inventory:\n${returned}\n\nTracking: ${body.trackingNumber || 'Not provided'}\n\nPocketPull TCG Team` }, { emailType: 'cashout_fulfillment', cashoutId: body.cashoutId });
      } catch (emailErr) { console.error('[cashoutAdmin] email error:', emailErr); }
    }
    await writeLog(blink, { type: 'cashout', userId: adminId, username: admin.username || 'Admin', action: 'Cashout Fulfillment Updated', details: { cashoutId: body.cashoutId, shippedCards: result.shippedCards.length, returnedCards: result.returnedCards.length, status: result.request.status }, result: 'success' });
    return c.json({ success: true, status: result.request.status, shippedCards: result.shippedCards, returnedCards: result.returnedCards, trackingNumber: body.trackingNumber || result.request.tracking_number });
  } catch (err: any) {
    const status = /not found/i.test(err?.message || '') ? 404 : /Unauthorized|access required|already finalized|Invalid index/i.test(err?.message || '') ? 403 : 400;
    return c.json({ error: err?.message || 'Failed to fulfill cashout' }, status as any);
  }
});

export default app;
