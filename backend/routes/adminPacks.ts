import { Hono } from 'hono';
import { requireAuth, uid } from '../lib/auth';
import { query, transaction } from '../lib/postgres';

const app = new Hono();

const PACK_COLUMNS = new Set([
  'id', 'name', 'price', 'is_active', 'quantity_limit', 'current_quantity', 'expires_at',
  'data', 'cooldown_hours', 'pack_type', 'image_url',
]);
const CARD_COLUMNS = new Set([
  'id', 'pack_id', 'name', 'rarity', 'value', 'odds', 'image_url', 'data',
  'card_name', 'estimated_value', 'card_image_url', 'sort_order', 'quantity', 'pull_chance',
]);

const camelToSnake = (value: string) => value.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
const jsonColumns = new Set(['data']);

function normalize(input: Record<string, any>, known: Set<string>) {
  const columns: Record<string, any> = {};
  const extra: Record<string, any> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const column = camelToSnake(key);
    if (known.has(column)) columns[column] = value;
    else if (key !== 'data') extra[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'data')) {
    columns.data = { ...(input.data && typeof input.data === 'object' ? input.data : {}), ...extra };
  } else if (Object.keys(extra).length) {
    columns.data = extra;
  }
  return columns;
}

function dbValue(column: string, value: any) {
  if (jsonColumns.has(column) && value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function requireAdmin(c: any): Promise<string> {
  const secret = c.req.header('X-Admin-Secret');
  if (secret && secret !== 'true') {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return rows[0].id;
  }

  const userId = await requireAuth(c);
  const rows = await query<{ role: string; is_admin: number }>(
    'SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) {
    throw new Error('FORBIDDEN');
  }
  return userId;
}

function insertSql(table: string, values: Record<string, any>) {
  const keys = Object.keys(values);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  return {
    sql: `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
    params: keys.map(key => dbValue(key, values[key])),
  };
}

async function savePack(body: any, adminUserId: string) {
  const input = body?.pack || {};
  const cards = Array.isArray(body?.cards) ? body.cards : [];
  if (!String(input.name || '').trim()) throw new Error('Pack name is required.');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Valid pack price required.');
  if (!['standard', 'mystery'].includes(input.packType)) throw new Error('Invalid pack type.');
  if (!cards.every((c: any) => String(c.cardName || '').trim())) throw new Error('All cards need a name.');

  const qLimit = Math.min(50000, Math.max(0, parseInt(String(input.quantityLimit ?? 0), 10) || 0));
  const totalMysteryQuantity = cards.reduce((sum: number, c: any) => sum + Math.max(0, parseInt(String(c.quantity ?? 0), 10) || 0), 0);
  const currentQuantity = input.packType === 'mystery' ? totalMysteryQuantity : qLimit;
  const now = new Date();

  return transaction(async client => {
    let packId = String(input.id || '');
    const packValues = normalize({
      id: packId || `pack_${Date.now()}_${uid().slice(-6)}`,
      packType: input.packType,
      name: String(input.name).trim(),
      price,
      description: String(input.description || '').trim(),
      imageUrl: input.imageUrl || null,
      glowColor: input.glowColor || '#00c8ff',
      borderColor: input.borderColor || input.glowColor || '#00c8ff',
      isActive: input.isActive ? 1 : 0,
      sortOrder: parseInt(String(input.sortOrder ?? 0), 10) || 0,
      quantityLimit: qLimit,
      currentQuantity,
      cooldownHours: parseInt(String(input.cooldownHours ?? 0), 10) || 0,
      expiresAt: input.expiresAt || null,
      nameColor: input.nameColor || '#ffffff',
      descriptionColor: input.descriptionColor || '#ffffff',
      priceColor: input.priceColor || '#ffffff',
      buttonTextColor: input.buttonTextColor || '#ffffff',
      openAnotherButtonTextColor: input.openAnotherButtonTextColor || input.buttonTextColor || '#ffffff',
    }, PACK_COLUMNS);

    const existing = packId
      ? (await client.query('SELECT * FROM packs_catalog WHERE id=$1 FOR UPDATE', [packId])).rows[0]
      : null;

    if (!existing) {
      packId = packValues.id;
      const { sql, params } = insertSql('packs_catalog', packValues);
      await client.query(sql, params);
    } else {
      const data = {
        ...(existing.data && typeof existing.data === 'object' ? existing.data : {}),
        ...((packValues.data as Record<string, any>) || {}),
        adminUpdatedBy: adminUserId,
        adminUpdatedAt: now.toISOString(),
      };
      const updateValues = { ...packValues, data };
      delete updateValues.id;
      const keys = Object.keys(updateValues);
      const params = keys.map(key => dbValue(key, updateValues[key]));
      params.push(packId);
      await client.query(
        `UPDATE packs_catalog SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(',')} WHERE id=$${params.length}`,
        params,
      );
      await client.query('DELETE FROM pack_cards WHERE pack_id=$1', [packId]);
    }

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const quantity = Math.max(0, parseInt(String(c.quantity ?? 0), 10) || 0);
      const cardValues = normalize({
        id: `card_${Date.now()}_${uid().slice(-8)}_${i}`,
        packId,
        cardName: String(c.cardName).trim(),
        name: String(c.cardName).trim(),
        rarity: input.packType === 'mystery'
          ? (['secret', 'god'].includes(c.rarity) ? 'secret' : ['rare', 'ultra'].includes(c.rarity) ? 'rare' : 'common')
          : c.rarity,
        pullChance: input.packType === 'mystery'
          ? ((quantity / Math.max(1, totalMysteryQuantity)) * 100)
          : (Number(c.pullChance) || 0),
        estimatedValue: Number(c.estimatedValue) || 0,
        value: Number(c.estimatedValue) || 0,
        cardImageUrl: c.cardImageUrl || null,
        imageUrl: c.cardImageUrl || null,
        sortOrder: i,
        quantity: input.packType === 'mystery' ? quantity : 0,
        originalQuantity: input.packType === 'mystery' ? Math.max(0, Number(c.originalQuantity ?? quantity)) : 0,
      }, CARD_COLUMNS);
      const { sql, params } = insertSql('pack_cards', cardValues);
      await client.query(sql, params);
    }

    const saved = (await client.query('SELECT * FROM packs_catalog WHERE id=$1', [packId])).rows[0];
    const savedCards = (await client.query('SELECT * FROM pack_cards WHERE pack_id=$1 ORDER BY sort_order ASC, id ASC', [packId])).rows;
    return { pack: saved, cards: savedCards };
  });
}

app.post('/admin/packs', async c => {
  try {
    const adminUserId = await requireAdmin(c);
    const body = await c.req.json();
    const result = await savePack(body, adminUserId);
    return c.json({ success: true, ...result });
  } catch (error: any) {
    const message = error?.message || 'Pack save failed.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return c.json({ success: false, error: message }, status);
  }
});

app.delete('/admin/packs/:id', async c => {
  try {
    const adminUserId = await requireAdmin(c);
    const packId = c.req.param('id');
    if (!packId) return c.json({ success: false, error: 'Pack id is required.' }, 400);

    const result = await transaction(async client => {
      const packResult = await client.query('SELECT id,name,data FROM packs_catalog WHERE id=$1 FOR UPDATE', [packId]);
      if (!packResult.rowCount) return { deleted: false, archived: false, name: null };
      const pack = packResult.rows[0];
      const history = await client.query(
        `SELECT EXISTS(SELECT 1 FROM packs_opened WHERE pack_id=$1) AS opened,
                EXISTS(SELECT 1 FROM pack_odds_versions WHERE pack_id=$1) AS odds`,
        [packId],
      );
      const hasHistory = Boolean(history.rows[0]?.opened || history.rows[0]?.odds);

      if (hasHistory) {
        const data = {
          ...(pack.data && typeof pack.data === 'object' ? pack.data : {}),
          adminDeleted: true,
          adminDeletedBy: adminUserId,
          adminDeletedAt: new Date().toISOString(),
        };
        await client.query('UPDATE packs_catalog SET is_active=0,data=$1 WHERE id=$2', [JSON.stringify(data), packId]);
        await client.query('DELETE FROM pack_cards WHERE pack_id=$1', [packId]);
        return { deleted: false, archived: true, name: pack.name };
      }

      await client.query('DELETE FROM pack_cards WHERE pack_id=$1', [packId]);
      await client.query('DELETE FROM pack_odds_versions WHERE pack_id=$1', [packId]);
      await client.query('DELETE FROM packs_catalog WHERE id=$1', [packId]);
      return { deleted: true, archived: false, name: pack.name };
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    const message = error?.message || 'Pack delete failed.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return c.json({ success: false, error: message }, status);
  }
});

export default app;
