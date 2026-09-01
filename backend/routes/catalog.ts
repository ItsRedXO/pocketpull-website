import { Hono } from 'hono';
import { formatDistanceToNow } from 'date-fns';
import { getBlinkServer, requireAuth } from '../lib/auth';

const app = new Hono();

function db(c: any) { return getBlinkServer(c.env as any).db; }

function normalizePack(pack: any) {
  return { ...pack, packType: pack.packType === 'mystery' ? 'mystery' : 'standard', price: Number(pack.price), sortOrder: Number(pack.sortOrder ?? 0), isActive: Number(pack.isActive ?? 1), quantityLimit: Number(pack.quantityLimit ?? 0), currentQuantity: Number(pack.currentQuantity ?? 0), cooldownHours: Number(pack.cooldownHours ?? 0), expiresAt: pack.expiresAt || null, nameColor: pack.nameColor || '#ffffff', descriptionColor: pack.descriptionColor || '#ffffff', priceColor: pack.priceColor || '#ffffff', buttonTextColor: pack.buttonTextColor || '#ffffff', openAnotherButtonTextColor: pack.openAnotherButtonTextColor || pack.buttonTextColor || '#ffffff' };
}
function normalizeCard(card: any) {
  return { ...card, pullChance: Number(card.pullChance ?? 0), estimatedValue: Number(card.estimatedValue ?? 0), sortOrder: Number(card.sortOrder ?? 0), quantity: Number(card.quantity ?? 0), originalQuantity: Number(card.originalQuantity ?? card.quantity ?? 0) };
}
async function visibleUsers(database: any, userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();
  const users = await database.users.list({ where: { id: { in: userIds } } });
  return new Map((users as any[]).filter(u => Number(u.isDeleted ?? u.is_deleted ?? 0) === 0 && Number(u.isBanned ?? u.is_banned ?? 0) === 0).map(u => [u.id, u.username || u.displayName || 'Trainer']));
}

app.get('/catalog/packs', async c => {
  try { const packs = await db(c).packsCatalog.list({ where: { isActive: 1 }, orderBy: { price: 'asc' } }); return c.json({ packs: packs.map(normalizePack) }); }
  catch (err) { console.error('[catalog/packs]', err); return c.json({ error: 'Failed to load packs' }, 500); }
});

app.get('/catalog/packs/:packId/cards', async c => {
  try { const database = db(c); const pack = await database.packsCatalog.get(c.req.param('packId')) as any; if (!pack || Number(pack.isActive) !== 1) return c.json({ error: 'Pack not found' }, 404); const cards = await database.packCards.list({ where: { packId: pack.id }, orderBy: { sortOrder: 'asc' } }); return c.json({ cards: cards.map(normalizeCard) }); }
  catch (err) { console.error('[catalog/pack-cards]', err); return c.json({ error: 'Failed to load pack cards' }, 500); }
});

app.get('/catalog/cooldowns', async c => {
  try { const userId = await requireAuth(c); const rows = await db(c).packCooldowns.list({ where: { userId } }); return c.json({ cooldowns: rows }); }
  catch (err: any) { if (err.message === 'ACCOUNT_DEACTIVATED') return c.json({ error: 'Account deactivated' }, 403); return c.json({ error: 'Authentication required' }, 401); }
});

app.get('/catalog/all-cards', async c => {
  try { const database = db(c); const activePacks = await database.packsCatalog.list({ where: { isActive: 1 } }); const standardPacks = (activePacks as any[]).filter(p => (p.packType || 'standard') === 'standard'); if (!standardPacks.length) return c.json({ cards: [] }); const ids = standardPacks.map(p => p.id); const packMap = new Map(standardPacks.map(p => [p.id, p.name])); const cards = await database.packCards.list({ orderBy: { estimatedValue: 'desc' }, limit: 3000 }); return c.json({ cards: cards.filter((card: any) => ids.includes(card.packId)).map((card: any) => ({ ...normalizeCard(card), packName: packMap.get(card.packId) || 'Mystery Pack' })) }); }
  catch (err) { console.error('[catalog/all-cards]', err); return c.json({ error: 'Failed to load cards' }, 500); }
});

app.get('/catalog/recent-pulls', async c => {
  try { const database = db(c); const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 12))); const pulls = await database.inventory.list({ orderBy: { createdAt: 'desc' }, limit }); const userMap = await visibleUsers(database, [...new Set((pulls as any[]).map(p => p.userId).filter(Boolean))]); const data = (pulls as any[]).map(p => ({ ...p, user: userMap.get(p.userId) || 'Trainer', time: p.createdAt ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }) : '' })); return c.json({ pulls: data }); }
  catch (err) { console.error('[catalog/recent-pulls]', err); return c.json({ error: 'Failed to load recent pulls' }, 500); }
});

app.get('/catalog/hall-of-fame', async c => {
  try { const database = db(c); const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 5))); const pulls = await database.inventory.list({ orderBy: { value: 'desc' }, limit }); const userMap = await visibleUsers(database, [...new Set((pulls as any[]).map(p => p.userId).filter(Boolean))]); const data = (pulls as any[]).filter(p => userMap.has(p.userId)).map(p => ({ ...p, user: userMap.get(p.userId), time: p.createdAt ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }) : '' })); return c.json({ pulls: data }); }
  catch (err) { console.error('[catalog/hall-of-fame]', err); return c.json({ error: 'Failed to load Hall of Fame' }, 500); }
});

app.get('/catalog/god-pulls', async c => {
  try { const database = db(c); const cards = await database.packCards.list({ where: { rarity: 'god' }, limit: 50 }); const packIds = [...new Set((cards as any[]).map(card => card.packId).filter(Boolean))]; const packs = packIds.length ? await database.packsCatalog.list({ where: { id: { in: packIds } } }) : []; const packMap = new Map((packs as any[]).map(p => [p.id, p.name])); return c.json({ cards: (cards as any[]).map(card => ({ id: card.id, name: card.cardName, rarity: card.rarity, value: Number(card.estimatedValue) || 0, imageUrl: card.cardImageUrl, packName: packMap.get(card.packId) || 'Mystery Pack', glow: '#ff00ff' })) }); }
  catch (err) { console.error('[catalog/god-pulls]', err); return c.json({ error: 'Failed to load God pulls' }, 500); }
});

export default app;
