import { Hono } from 'hono';
import { requireAuth, getBlinkServer, uid, getRewardUserId } from '../lib/auth';
import { writeLog } from './logs';
import { processWalletTransaction } from '../lib/wallet';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../lib/provablyFair';
const app = new Hono();
const RARITY_EMOJIS: Record<string, string> = { common: '🃏', uncommon: '🌿', rare: '💧', ultra: '🌙', secret: '⭐', god: '🌈' };
app.post('/open-pack', async c => {
  let userId: string; try { userId = await requireAuth(c); } catch (err: any) { return c.json({ error: err.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401); }
  const blink = getBlinkServer(c.env as any); const db = blink.db;
  try {
    const { packId } = await c.req.json().catch(() => ({})); if (!packId) return c.json({ error: 'packId required' }, 400);
    const [pack, user] = await Promise.all([db.packsCatalog.get(packId), db.users.get(userId)]) as any[];
    if (!pack || !Number(pack.isActive)) return c.json({ error: 'Pack not found or inactive' }, 404);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.isDeleted || 0) > 0) return c.json({ error: 'Account deactivated' }, 403);
    if (Number(user.isBanned || 0) > 0) return c.json({ error: 'Account banned' }, 403);
    const packPrice = Number(pack.price); const quantityLimit = Number(pack.quantityLimit || 0); const currentQuantity = Number(pack.currentQuantity || 0);
    if (pack.expiresAt && new Date(pack.expiresAt) < new Date()) return c.json({ error: 'This pack has expired' }, 400);
    if (quantityLimit > 0 && currentQuantity <= 0) return c.json({ error: 'Pack is sold out' }, 400);
    const cooldownHours = Number(pack.cooldownHours || 0);
    if (cooldownHours > 0) { const rows = await db.packCooldowns.list({ where: { userId, packId } }); const last = rows[0]; if (last) { const diff = (Date.now() - new Date(last.lastOpenedAt).getTime()) / 3600000; if (diff < cooldownHours) return c.json({ error: `Cooldown active: ${Math.ceil(cooldownHours - diff)}h remaining` }, 400); } }
    const spendable = Number(user.balance || 0) + Number(user.matchedBalance || 0); if (packPrice > 0 && spendable < packPrice) return c.json({ error: `Insufficient balance. Need ${packPrice.toFixed(2)}, have ${spendable.toFixed(2)}` }, 400);
    let cards = await db.packCards.list({ where: { packId }, orderBy: { sortOrder: 'asc' } }) as any[];
    const mystery = (pack.packType || 'standard') === 'mystery';
    if (mystery) { cards = cards.filter(card => Number(card.quantity || 0) > 0); const units = cards.reduce((sum, card) => sum + Number(card.quantity || 0), 0); cards = cards.map(card => ({ ...card, pullChance: units ? Number(card.quantity || 0) / units * 100 : 0 })); }
    if (!cards.length) return c.json({ error: mystery ? 'This Mystery Pack is sold out' : 'No cards configured for this pack' }, 400);
    const serverSeed = c.env.BLINK_SERVER_SEED; if (!serverSeed) return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    const seeds = await db.serverSeeds.list({ orderBy: { createdAt: 'desc' }, limit: 10 }) as any[]; const actualHash = await sha256(serverSeed); const seed = seeds.find(s => (s.status === 'active' || s.status === 'pending') && s.seedHash === actualHash); if (!seed) return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    const oddsJson = buildOddsSnapshot(cards); const oddsVersionHash = await sha256(oddsJson);
    try { await db.table('packOddsVersions').upsert({ contentHash: oddsVersionHash, packId, oddsJson, cardCount: cards.length }); } catch {}
    const nonceResult = await db.query('INSERT INTO user_nonces (user_id, pack_nonce) VALUES ($1, 1) ON CONFLICT(user_id) DO UPDATE SET pack_nonce = user_nonces.pack_nonce + 1 RETURNING pack_nonce', [userId]);
    const nonce = Number(nonceResult.rows[0]?.pack_nonce); if (!Number.isFinite(nonce)) throw new Error('Nonce persistence failed');
    const clientSeed = `cs_${uid()}`; const rollValue = await computeRoll(serverSeed, clientSeed, nonce); const picked = cards[selectCardIndex(rollValue, cards)] as any;
    if (mystery) { const claimed = await db.query('UPDATE pack_cards SET quantity = quantity - 1 WHERE id = $1 AND quantity > 0 RETURNING id', [picked.id]); if (claimed.rows.length !== 1) return c.json({ error: 'That Mystery Pack card just sold out. Please try again.' }, 409); const remaining = await db.query('SELECT COALESCE(SUM(quantity),0) AS total FROM pack_cards WHERE pack_id = $1', [packId]); await db.packsCatalog.update(packId, { currentQuantity: Number(remaining.rows[0]?.total || 0) }); }
    const cardName = picked.cardName || 'Unknown Card'; const rarity = picked.rarity || 'common'; const cardValue = Number(picked.estimatedValue || 0); const cardImageUrl = picked.cardImageUrl || null; const cardId = `${cardName.toLowerCase().replace(/\s+/g, '_')}_${rarity}`; const isBot = user.isBot === true || Number(user.isBot || 0) > 0; const recipientId = getRewardUserId(userId, isBot); const inventoryId = `inv_${uid()}`;
    await db.inventory.create({ id: inventoryId, userId: recipientId, cardId, cardName, rarity, value: cardValue, emoji: RARITY_EMOJIS[rarity] || '🃏', isFavorite: 0, isLocked: 0, cardImageUrl, packName: pack.name });
    const walletResult = await processWalletTransaction(blink, { userId, type: 'pack_open', amount: -packPrice, matchedAmount: Number(user.matchedBalance || 0), sourceId: inventoryId }); if (!walletResult.success) throw new Error(`Failed to deduct balance: ${walletResult.error}`);
    const writes: Promise<unknown>[] = []; if (quantityLimit > 0 && !mystery) writes.push(db.packsCatalog.update(packId, { currentQuantity: Math.max(0, currentQuantity - 1) })); if (cooldownHours > 0) writes.push(db.packCooldowns.upsert({ id: `${userId}_${packId}`, userId, packId, lastOpenedAt: new Date().toISOString() })); writes.push(db.table('packsOpened').create({ id: `po_${uid()}`, userId, packId, packName: pack.name, cost: packPrice, cardName, rarity, clientSeed, nonce, rollValue, serverSeedHash: actualHash, oddsVersionHash, provablyFair: 1 })); writes.push(writeLog(blink, { id: `log_${uid()}`, type: 'pack_open', userId, action: 'opened_pack', details: { packId, packName: pack.name, cardName, rarity }, valueIn: packPrice, valueOut: cardValue, result: cardName })); Promise.allSettled(writes).catch(() => {});
    return c.json({ success: true, card: { id: inventoryId, cardId, cardName, rarity, value: cardValue, cardImageUrl, packName: pack.name }, provablyFair: { clientSeed, nonce, rollValue, serverSeedHash: actualHash, oddsVersionHash } });
  } catch (err: any) { console.error('[open-pack]', err); return c.json({ error: err.message || 'Failed to open pack' }, 500); }
});
export default app;
