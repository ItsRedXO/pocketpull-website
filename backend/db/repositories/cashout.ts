import { getDb, type DbEnv } from '../client';

export interface CashoutCard {
  card_id: string | null;
  card_name: string;
  rarity: string | null;
  value: number;
  card_image_url: string;
  pack_name: string;
  emoji: string;
}

export interface CreateCashoutInput {
  id: string;
  userId: string;
  confirmationNumber: string;
  shipping: { name: string; address: string; city: string; state: string; zip: string; country?: string; email?: string; phone?: string };
  idImageUrl: string;
}

export async function createCashout(env: DbEnv, input: CreateCashoutInput) {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query<any>(`SELECT username, display_name, email, is_deleted, is_banned FROM users WHERE id = $1 FOR UPDATE`, [input.userId]);
    const user = userResult.rows[0];
    if (!user) throw new Error('User not found');
    if (user.is_deleted) throw new Error('Account deactivated');
    if (user.is_banned) throw new Error('Account banned');

    const cardsResult = await client.query<any>(`SELECT id,user_id,card_id,card_name,rarity,value,emoji,card_image_url,pack_name,is_locked FROM inventory WHERE id = ANY($1::text[]) AND user_id = $2 FOR UPDATE`, [input.cardIds || [], input.userId]);
    const cards = cardsResult.rows;
    if (cards.length !== (input.cardIds || []).length) throw new Error('One or more selected cards are not in your inventory');
    if (cards.some((card: any) => Boolean(card.is_locked))) throw new Error('One or more selected cards are locked');

    const snapshots: CashoutCard[] = cards.map((card: any) => ({
      card_id: card.card_id,
      card_name: card.card_name,
      rarity: card.rarity,
      value: Number(card.value || 0),
      card_image_url: card.card_image_url || '',
      pack_name: card.pack_name || '',
      emoji: card.emoji || '🃏',
    }));
    const totalValue = snapshots.reduce((sum, card) => sum + card.value, 0);
    const cashoutResult = await client.query<any>(`
      INSERT INTO cashout_requests
        (id,user_id,username,confirmation_number,status,total_value,total_cards,cards_json,
         shipping_name,shipping_address,shipping_city,shipping_state,shipping_zip,shipping_country,notes,id_image_url,created_at,updated_at)
      VALUES ($1,$2,$3,'pending',$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
      RETURNING id,confirmation_number,total_value,total_cards,cards_json,username`, [
        input.id, input.userId, user.username || user.display_name || 'Trainer',
        'pending', totalValue, snapshots.length, JSON.stringify(snapshots),
        input.shipping.name, input.shipping.address, input.shipping.city, input.shipping.state,
        input.shipping.zip, input.shipping.country || 'US',
        `Email: ${input.shipping.email || user.email || ''} | Phone: ${input.shipping.phone || ''}`,
        input.idImageUrl,
      ]);
    await client.query(`DELETE FROM inventory WHERE id = ANY($1::text[]) AND user_id = $2`, [input.cardIds || [], input.userId]);
    await client.query('COMMIT');
    return { request: cashoutResult.rows[0], cards: snapshots, username: user.username || user.display_name || 'Trainer', email: input.shipping.email || user.email || '' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function getCashout(env: DbEnv, id: string) {
  const result = await getDb(env).query(`SELECT * FROM cashout_requests WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] || null;
}

export async function partialFulfillCashout(env: DbEnv, input: { cashoutId: string; fulfilledIndices: number[]; trackingNumber?: string }) {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<any>(`SELECT * FROM cashout_requests WHERE id = $1 FOR UPDATE`, [input.cashoutId]);
    const req = result.rows[0];
    if (!req) throw new Error('Cashout request not found');
    if (['shipped','canceled'].includes(req.status)) throw new Error('Cashout request is already finalized');
    const cards: CashoutCard[] = Array.isArray(req.cards_json) ? req.cards_json : JSON.parse(req.cards_json || '[]');
    const prior: number[] = Array.isArray(req.fulfilled_card_ids) ? req.fulfilled_card_ids : JSON.parse(req.fulfilled_card_ids || '[]');
    const fulfilled = new Set<number>([...prior, ...input.fulfilledIndices.map(Number)]);
    for (const index of fulfilled) if (!Number.isInteger(index) || index < 0 || index >= cards.length) throw new Error(`Invalid index: ${index}`);
    const shippedCards = cards.filter((_card, i) => fulfilled.has(i));
    const returnedCards = cards.filter((_card, i) => !fulfilled.has(i) && !prior.includes(i));
    for (const card of returnedCards) {
      await client.query(`INSERT INTO inventory (id,user_id,card_id,card_name,rarity,value,emoji,is_favorite,created_at,card_image_url,pack_name,is_locked,battle_id) VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,NOW(),$8,$9,FALSE,NULL)`, [
        `inv_${crypto.randomUUID()}`, req.user_id, card.card_id, card.card_name, card.rarity || 'common', card.value, card.emoji || '🃏', card.card_image_url || null, card.pack_name || null,
      ]);
    }
    const status = fulfilled.size < cards.length ? 'partial' : 'shipped';
    const shippedValue = shippedCards.reduce((sum, card) => sum + Number(card.value || 0), 0);
    await client.query(`UPDATE cashout_requests SET status=$2,fulfilled_card_ids=$3::jsonb,total_value=$4,total_cards=$5,tracking_number=COALESCE($6,tracking_number),processed_at=NOW(),updated_at=NOW() WHERE id=$1`, [input.cashoutId, status, JSON.stringify([...fulfilled]), shippedValue, shippedCards.length, input.trackingNumber || null]);
    await client.query('COMMIT');
    return { request: { ...req, status, total_value: shippedValue, total_cards: shippedCards.length }, shippedCards, returnedCards };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally { client.release(); }
}
