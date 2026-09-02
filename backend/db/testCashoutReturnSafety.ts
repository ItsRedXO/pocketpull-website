import { getDb } from '../lib/postgres';

const db = getDb();
const suffix = Date.now().toString(36);
const userId = `test_cashout_user_${suffix}`;
const cashoutId = `test_cashout_${suffix}`;
const firstInventoryId = `test_cashout_inv_a_${suffix}`;
const duplicateInventoryId = `test_cashout_inv_b_${suffix}`;
const cards = [
  { card_name: 'Shipped Card', rarity: 'rare', value: 10, card_image_url: 'https://example.test/a.png', pack_name: 'Test Pack' },
  { card_name: 'Returned Card', rarity: 'rare', value: 20, card_image_url: 'https://example.test/b.png', pack_name: 'Test Pack' },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await db.query('INSERT INTO users(id, username, balance, matched_balance) VALUES($1,$2,0,0)', [userId, 'cashout-test']);
  await db.query(
    `INSERT INTO cashout_requests(id,user_id,status,cards_json,total_value,total_cards,fulfilled_card_ids,created_at)
     VALUES($1,$2,'pending',$3,$4,2,'[]'::jsonb,now())`,
    [cashoutId, userId, JSON.stringify(cards), 30],
  );

  // Mimic the admin route returning index 1 immediately before its first partial update.
  await db.query(
    `INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,card_image_url,pack_name,sold,created_at,data)
     VALUES($1,$2,'returned-card','Returned Card','rare',20,'https://example.test/b.png','Test Pack',0,now(),'{}'::jsonb)`,
    [firstInventoryId, userId],
  );
  await db.query(
    `UPDATE cashout_requests
     SET status='partial', fulfilled_card_ids='[0]'::jsonb, total_value=10, total_cards=1, updated_at=now(), processed_at=now()
     WHERE id=$1`,
    [cashoutId],
  );

  let rows = (await db.query(
    `SELECT id, data FROM inventory WHERE user_id=$1 AND sold=0 ORDER BY created_at`,
    [userId],
  )).rows;
  assert(rows.length === 1, `expected one returned inventory row after first partial update, got ${rows.length}`);
  assert(rows[0].id === firstInventoryId, 'first returned inventory row changed unexpectedly');
  assert(rows[0].data?.cashout_return_id === cashoutId, 'returned inventory row was not tagged with cashout id');
  assert(Number(rows[0].data?.cashout_return_index) === 1, 'returned inventory row was not tagged with card index');

  // Mimic a second admin partial call re-inserting the still-unfulfilled card.
  await db.query(
    `INSERT INTO inventory(id,user_id,card_id,card_name,rarity,value,card_image_url,pack_name,sold,created_at,data)
     VALUES($1,$2,'returned-card','Returned Card','rare',20,'https://example.test/b.png','Test Pack',0,now(),'{}'::jsonb)`,
    [duplicateInventoryId, userId],
  );
  await db.query(
    `UPDATE cashout_requests
     SET status='partial', fulfilled_card_ids='[0]'::jsonb, updated_at=now(), processed_at=now()
     WHERE id=$1`,
    [cashoutId],
  );

  rows = (await db.query(`SELECT id FROM inventory WHERE user_id=$1 AND sold=0`, [userId])).rows;
  assert(rows.length === 1, `repeated partial fulfillment duplicated returned inventory; got ${rows.length} rows`);
  assert(rows[0].id === firstInventoryId, 'trigger removed the tracked returned row instead of the fresh duplicate');

  // Once the returned card is sold, the old cashout must not be able to ship it too.
  await db.query('UPDATE inventory SET sold=1 WHERE id=$1', [firstInventoryId]);
  let blocked = false;
  try {
    await db.query(
      `UPDATE cashout_requests
       SET status='shipped', fulfilled_card_ids='[0,1]'::jsonb, total_value=30, total_cards=2, updated_at=now(), processed_at=now()
       WHERE id=$1`,
      [cashoutId],
    );
  } catch (error: any) {
    blocked = error?.code === 'P0001';
  }
  assert(blocked, 'cashout allowed a previously-returned card to ship after that inventory row was sold');

  const cashout = (await db.query(`SELECT status, fulfilled_card_ids FROM cashout_requests WHERE id=$1`, [cashoutId])).rows;
  assert(cashout[0]?.status === 'partial', 'failed fulfillment changed cashout status');
  assert(JSON.stringify(cashout[0]?.fulfilled_card_ids) === JSON.stringify([0]), 'failed fulfillment changed fulfilled card indices');

  console.log('cashout return safety test passed');
} finally {
  await db.query('DELETE FROM inventory WHERE user_id=$1', [userId]).catch(() => undefined);
  await db.query('DELETE FROM cashout_requests WHERE id=$1', [cashoutId]).catch(() => undefined);
  await db.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => undefined);
  await db.end();
}
