import { Hono } from 'hono';
import { getBlinkServer, uid } from '../lib/auth';
import { query, transaction } from '../lib/postgres';
import { sendEmailWithLog } from '../lib/emailLogging';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { canReturnCashout } from '../lib/cashoutAdminPolicy';

const app = new Hono();

interface CashoutCard {
  card_name: string;
  rarity?: string;
  value: number;
  card_image_url?: string;
  pack_name?: string;
  emoji?: string;
  inventory_id?: string;
}

async function requireAdmin(c: any): Promise<void> {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return;
  }

  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const blink = getBlinkServer(c.env as any);
  const auth = await blink.auth.verifyToken(authorization);
  if (!auth.valid || !auth.userId) throw new Error('UNAUTHORIZED');
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [auth.userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
}

function parseCards(value: unknown): CashoutCard[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function parseIndices(value: unknown): number[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? [...new Set(parsed.map(Number).filter(Number.isInteger))] : [];
}

function cardId(card: CashoutCard): string {
  return (card.card_name || 'unknown-card').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function findSoldInventoryId(client: any, userId: string, card: CashoutCard): Promise<string | null> {
  if (card.inventory_id) {
    const exact = await client.query(
      'SELECT id FROM inventory WHERE id=$1 AND user_id=$2 AND COALESCE(sold,0)=1 FOR UPDATE',
      [card.inventory_id, userId],
    );
    return exact.rows[0]?.id || null;
  }

  const rows = await client.query(
    `SELECT id FROM inventory
     WHERE user_id=$1 AND COALESCE(sold,0)=1 AND card_id=$2
       AND ABS(COALESCE(value,0)-$3)<0.0001
       AND COALESCE(rarity,'')=COALESCE($4,'')
       AND COALESCE(card_image_url,'')=COALESCE($5,'')
       AND COALESCE(pack_name,'')=COALESCE($6,'')
     ORDER BY created_at DESC
     LIMIT 1 FOR UPDATE`,
    [userId, cardId(card), Number(card.value) || 0, card.rarity || '', card.card_image_url || '', card.pack_name || ''],
  );
  return rows.rows[0]?.id || null;
}

function emailFor(req: any): string | null {
  const match = String(req.notes || '').match(/Email:\s*([^\s|]+)/i);
  return match?.[1] || null;
}

app.post('/admin/cashout/partial-fulfill', async c => {
  try {
    await requireAdmin(c);
    const body = await c.req.json().catch(() => ({}));
    const cashoutId = String(body.cashoutId || '');
    const requested = parseIndices(body.fulfilledIndices);
    const trackingNumber = String(body.trackingNumber || '').trim();
    if (!cashoutId) return c.json({ error: 'cashoutId required' }, 400);
    if (requested.length === 0) return c.json({ error: 'Select at least one card to fulfill' }, 400);

    const result = await transaction(async client => {
      const result = await client.query('SELECT * FROM cashout_requests WHERE id=$1 FOR UPDATE', [cashoutId]);
      const req = result.rows[0] as any;
      if (!req) return { kind: 'not_found' as const };
      if (['returned', 'cancelled', 'completed', 'shipped'].includes(String(req.status))) return { kind: 'closed' as const, status: req.status };

      const cards = parseCards(req.cards_json);
      if (!cards.length) return { kind: 'no_cards' as const };
      for (const index of requested) if (index < 0 || index >= cards.length) return { kind: 'bad_index' as const, index };

      const prior = new Set(parseIndices(req.fulfilled_card_ids));
      const effective = new Set([...prior, ...requested]);
      const returned = cards
        .map((card, index) => ({ card, index }))
        .filter(({ index }) => !effective.has(index) && !prior.has(index));

      // For the first partial fulfillment, create one precisely tagged inventory row
      // for each unfulfilled card. The DB trigger then protects those rows on later calls.
      if (req.status !== 'partial') {
        for (const { card, index } of returned) {
          await client.query(
            `INSERT INTO inventory
              (id,user_id,card_id,card_name,rarity,value,card_image_url,pack_name,sold,created_at,data)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,now(),$9::jsonb)`,
            [
              `inv_${uid()}`,
              req.user_id,
              cardId(card),
              card.card_name || 'Unknown Card',
              card.rarity || 'common',
              Number(card.value) || 0,
              card.card_image_url || null,
              card.pack_name || null,
              JSON.stringify({ cashout_return_id: cashoutId, cashout_return_index: index }),
            ],
          );
        }
      }

      const shippedCards = cards.filter((_, index) => effective.has(index));
      const shippedValue = shippedCards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
      const newStatus = effective.size < cards.length ? 'partial' : 'shipped';
      const now = new Date().toISOString();

      await client.query(
        `UPDATE cashout_requests SET status=$1, fulfilled_card_ids=$2::jsonb,
          total_value=$3, total_cards=$4, tracking_number=COALESCE(NULLIF($5,''),tracking_number),
          updated_at=$6, processed_at=$6 WHERE id=$7`,
        [newStatus, JSON.stringify([...effective]), shippedValue, shippedCards.length, trackingNumber, now, cashoutId],
      );

      return {
        kind: 'ok' as const,
        req,
        cards,
        shippedCards,
        returnedCards: returned.map(({ card }) => card),
        shippedValue,
        newStatus,
        trackingNumber: trackingNumber || req.tracking_number || '',
      };
    });

    if (result.kind === 'not_found') return c.json({ error: 'Cashout request not found' }, 404);
    if (result.kind === 'closed') return c.json({ error: `Cashout is already ${result.status}` }, 409);
    if (result.kind === 'no_cards') return c.json({ error: 'No cards in request' }, 400);
    if (result.kind === 'bad_index') return c.json({ error: `Invalid card index: ${result.index}` }, 400);

    const blink = getBlinkServer(c.env as any);
    const recipient = emailFor(result.req);
    if (recipient) {
      try {
        const returned = result.returnedCards;
        const shipped = result.shippedCards;
        const bodyText = [
          `Hi ${result.req.username || 'Trainer'},`,
          '',
          `Your cashout request #${result.req.confirmation_number} has been processed.`,
          '',
          `Cards shipped (${shipped.length}):`,
          ...shipped.map(c => `- ${c.card_name} — $${(Number(c.value) || 0).toFixed(2)}`),
          '',
          ...(returned.length ? [`Cards returned to inventory (${returned.length}):`, ...returned.map(c => `- ${c.card_name} — $${(Number(c.value) || 0).toFixed(2)}`), ''] : []),
          ...(result.trackingNumber ? [`Tracking: ${result.trackingNumber}`, ''] : []),
          '— PocketPull TCG',
        ].join('\n');
        await sendEmailWithLog(blink, {
          to: recipient,
          from: 'support@pocketpulltcg.com',
          replyTo: 'support@pocketpulltcg.com',
          subject: `PocketPull TCG — Cashout Update #${result.req.confirmation_number}`,
          text: bodyText,
          html: `<p>Hi <strong>${result.req.username || 'Trainer'}</strong>,</p><p>Your cashout request <strong>#${result.req.confirmation_number}</strong> has been processed.</p><p><strong>Cards shipped:</strong> ${result.shippedCards.map(c => c.card_name).join(', ') || 'None'}</p>${result.returnedCards.length ? `<p><strong>Returned to inventory:</strong> ${result.returnedCards.map(c => c.card_name).join(', ')}</p>` : ''}${result.trackingNumber ? `<p><strong>Tracking:</strong> ${result.trackingNumber}</p>` : ''}`,
        }, { emailType: 'cashout_update', cashoutId });
      } catch (error) {
        console.error('[cashoutAdminV2] email error:', error);
      }
    }

    return c.json({
      success: true,
      status: result.newStatus,
      fulfilledCardIds: [...new Set(parseIndices(result.req.fulfilled_card_ids).concat(parseIndices(body.fulfilledIndices)))],
      totalValue: result.shippedValue,
      totalCards: result.shippedCards.length,
      returnedCards: result.returnedCards.length,
      trackingNumber: result.trackingNumber || null,
    });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Cashout fulfillment failed' }, status);
  }
});

app.post('/admin/cashout/return', async c => {
  try {
    await requireAdmin(c);
    const body = await c.req.json().catch(() => ({}));
    const cashoutId = String(body.cashoutId || '');
    if (!cashoutId) return c.json({ error: 'cashoutId required' }, 400);

    const result = await transaction(async client => {
      const rows = await client.query('SELECT * FROM cashout_requests WHERE id=$1 FOR UPDATE', [cashoutId]);
      const req = rows.rows[0] as any;
      if (!req) return { kind: 'not_found' as const };
      if (!canReturnCashout(req.status)) return { kind: 'not_returnable' as const, status: req.status };

      const cards = parseCards(req.cards_json);
      const restored: string[] = [];
      for (const card of cards) {
        const inventoryId = await findSoldInventoryId(client, req.user_id, card);
        if (!inventoryId) return { kind: 'missing_inventory' as const, card: card.card_name || 'Unknown Card' };
        await client.query('UPDATE inventory SET sold=0 WHERE id=$1', [inventoryId]);
        restored.push(inventoryId);
      }

      await client.query(
        `UPDATE cashout_requests SET status='returned', fulfilled_card_ids='[]'::jsonb,
          updated_at=now(), processed_at=now() WHERE id=$1`,
        [cashoutId],
      );
      return { kind: 'ok' as const, req, restoredCount: restored.length };
    });

    if (result.kind === 'not_found') return c.json({ error: 'Cashout request not found' }, 404);
    if (result.kind === 'not_returnable') return c.json({ error: `Cashout cannot be returned after it reaches ${result.status}` }, 409);
    if (result.kind === 'missing_inventory') return c.json({ error: `Could not locate the original inventory row for ${result.card}. No changes were committed.` }, 409);

    return c.json({ success: true, status: 'returned', restoredCards: result.restoredCount });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500;
    return c.json({ error: error?.message || 'Cashout return failed' }, status);
  }
});

export default app;
