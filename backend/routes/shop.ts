import { Hono } from 'hono';
import { requireAuth, uid } from '../lib/auth';
import { query, transaction } from '../lib/postgres';
import { deductGemsInClient } from '../lib/gems';

const app = new Hono();

const TIER_RANGES = [
  { min: 5,   max: 15,  slots: 5 },
  { min: 16,  max: 30,  slots: 5 },
  { min: 40,  max: 100, slots: 5 },
  { min: 101, max: 500, slots: 5 },
];

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = (day + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - offset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getNextRefreshDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

async function generateWeeklyRotation(weekStart: string): Promise<void> {
  let slotIndex = 0;

  for (const tier of TIER_RANGES) {
    const rows = await query(
      `SELECT id, card_name, rarity, estimated_value, card_image_url, pack_id
       FROM pack_cards
       WHERE COALESCE(estimated_value, 0) >= $1 AND COALESCE(estimated_value, 0) <= $2
       ORDER BY RANDOM()
       LIMIT 30`,
      [tier.min, tier.max],
    ) as any[];

    const seen = new Set<string>();
    const unique = rows.filter(r => {
      if (seen.has(r.card_name)) return false;
      seen.add(r.card_name);
      return true;
    }).slice(0, tier.slots);

    for (const card of unique) {
      const gemPrice = Math.max(500, Math.round(Number(card.estimated_value) * 100));
      await query(
        `INSERT INTO shop_rotation(id, week_start, slot_index, card_id, pack_id, card_name, card_image_url, card_rarity, estimated_value, gem_price)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (week_start, slot_index) DO NOTHING`,
        [
          `sr_${uid()}`, weekStart, slotIndex,
          String(card.id), card.pack_id ? String(card.pack_id) : null,
          card.card_name, card.card_image_url || null, card.rarity || null,
          Number(card.estimated_value), gemPrice,
        ],
      );
      slotIndex++;
    }

    const tierEnd = Math.ceil(slotIndex / 5) * 5;
    slotIndex = tierEnd;
  }
}

app.get('/shop/rotation', async (c) => {
  let userId: string | null = null;
  try { userId = await requireAuth(c); } catch { /* ok — unauthenticated browsing allowed */ }

  const weekStart = getWeekStart();

  let rotation = await query(
    `SELECT * FROM shop_rotation WHERE week_start = $1 ORDER BY slot_index ASC`,
    [weekStart],
  ) as any[];

  if (rotation.length < 20) {
    await query(`DELETE FROM shop_rotation WHERE week_start = $1`, [weekStart]);
    await generateWeeklyRotation(weekStart);
    rotation = await query(
      `SELECT * FROM shop_rotation WHERE week_start = $1 ORDER BY slot_index ASC`,
      [weekStart],
    ) as any[];
  }

  let gemsBalance = 0;
  if (userId) {
    const rows = await query(`SELECT gems FROM users WHERE id = $1`, [userId]) as any[];
    gemsBalance = Number(rows[0]?.gems || 0);
  }

  return c.json({ success: true, rotation, weekStart, nextRefresh: getNextRefreshDate(), gemsBalance });
});

app.get('/shop/gems', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch { return c.json({ error: 'Authentication required' }, 401); }

  const rows = await query(`SELECT gems FROM users WHERE id = $1`, [userId]) as any[];
  return c.json({ success: true, gems: Number(rows[0]?.gems || 0) });
});

app.post('/shop/purchase', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch { return c.json({ error: 'Authentication required' }, 401); }

  const { shopItemId } = await c.req.json<any>().catch(() => ({}));
  if (!shopItemId) return c.json({ error: 'shopItemId required' }, 400);

  try {
    const result = await transaction(async (client) => {
      const userResult = await client.query(
        `SELECT id, gems, is_deleted, is_banned FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      );
      if (!userResult.rowCount) throw Object.assign(new Error('User not found'), { status: 404 });
      const user = userResult.rows[0] as any;
      if (Number(user.is_deleted || 0) > 0) throw Object.assign(new Error('Account deactivated'), { status: 403 });
      if (Number(user.is_banned || 0) > 0) throw Object.assign(new Error('Account banned'), { status: 403 });

      const itemResult = await client.query(
        `SELECT * FROM shop_rotation WHERE id = $1 FOR UPDATE`,
        [shopItemId],
      );
      if (!itemResult.rowCount) throw Object.assign(new Error('Shop item not found'), { status: 404 });
      const item = itemResult.rows[0] as any;

      if (item.is_sold) throw Object.assign(new Error('This item has already been sold'), { status: 409 });

      const gemPrice = Number(item.gem_price);
      const gemResult = await deductGemsInClient(client, userId, gemPrice, 'shop_purchase', shopItemId);
      if (!gemResult.success) throw Object.assign(new Error(gemResult.error || 'Insufficient gems'), { status: 400 });

      await client.query(
        `UPDATE shop_rotation SET is_sold = true, sold_to_user_id = $1, sold_at = now() WHERE id = $2`,
        [userId, shopItemId],
      );

      const inventoryId = `inv_${uid()}`;
      await client.query(
        `INSERT INTO inventory(id, user_id, card_id, pack_id, card_name, rarity, value, emoji, card_image_url, is_favorite, favorite, is_locked, locked, sold, created_at)
         VALUES($1, $2, $3, $4, $5, $6, $7, '💎', $8, 0, 0, 0, 0, 0, now())`,
        [
          inventoryId, userId,
          item.card_id || `shop_${shopItemId}`,
          item.pack_id || null,
          item.card_name,
          item.card_rarity || 'rare',
          Number(item.estimated_value),
          item.card_image_url || null,
        ],
      );

      await client.query(
        `INSERT INTO shop_purchases(id, user_id, shop_item_id, gems_spent, inventory_id)
         VALUES($1, $2, $3, $4, $5)`,
        [`sp_${uid()}`, userId, shopItemId, gemPrice, inventoryId],
      );

      return { inventoryId, newGems: gemResult.newGems, item };
    });

    return c.json({
      success: true,
      inventoryId: result.inventoryId,
      newGems: result.newGems,
      card: {
        name: result.item.card_name,
        rarity: result.item.card_rarity,
        value: Number(result.item.estimated_value),
        imageUrl: result.item.card_image_url,
      },
    });
  } catch (err: any) {
    const status = [400, 401, 403, 404, 409].includes(Number(err?.status)) ? Number(err.status) : 500;
    return c.json({ error: err?.message || 'Purchase failed' }, status as any);
  }
});

export default app;
