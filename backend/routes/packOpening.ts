/** Pack opening is fully server-authoritative and PostgreSQL-backed. */
import { Hono } from 'hono';
import { requireAuth, uid, getRewardUserId } from '../lib/auth';
import { query, transaction } from '../lib/postgres';
import { writeLog } from './logs';
import { processWalletTransactionInClient } from '../repositories/wallet';
import { sha256, computeRoll, buildOddsSnapshot, selectCardIndex } from '../lib/provablyFair';

const app = new Hono();
const RARITY_EMOJIS: Record<string, string> = { common:'🃏', uncommon:'🌿', rare:'💧', ultra:'🌙', secret:'⭐', god:'🌈', chase:'🔥', premium:'✨', base:'🃏' };
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

class PackOpenError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

app.post('/open-pack', async (c) => {
  let userId: string;
  try { userId = await requireAuth(c); }
  catch (err: any) {
    return c.json({ error: err?.message === 'ACCOUNT_DEACTIVATED' ? 'Account deactivated' : 'Authentication required' }, err?.message === 'ACCOUNT_DEACTIVATED' ? 403 : 401);
  }

  try {
    const { packId } = await c.req.json<any>().catch(() => ({}));
    if (!packId) return c.json({ error: 'packId required' }, 400);

    const serverSeed = (c.env as any).BLINK_SERVER_SEED;
    if (!serverSeed) return c.json({ error: 'Provably fair system not initialized. Please contact support.' }, 500);
    const seedHash = await sha256(serverSeed);
    const seedRows = await query<any>("SELECT seed_hash,status,active FROM server_seeds WHERE (status IN ('active','pending') OR active=1) ORDER BY created_at DESC LIMIT 10");
    if (!seedRows.some((seed:any) => seed.seed_hash === seedHash)) {
      return c.json({ error: 'Provably fair integrity error. Please contact support.' }, 500);
    }

    const clientSeed = `cs_${uid()}`;
    const result = await transaction(async (client) => {
      // Lock the user and pack first. This serializes concurrent opens for the same user/pack.
      const userResult = await client.query(`SELECT * FROM users WHERE id=$1 FOR UPDATE`, [userId]);
      if (!userResult.rowCount) throw new PackOpenError('User not found', 404);
      const user:any = userResult.rows[0];
      if (num(user.is_deleted) > 0) throw new PackOpenError('Account deactivated', 403);
      if (num(user.is_banned) > 0) throw new PackOpenError('Account banned', 403);

      const packResult = await client.query(`SELECT * FROM packs_catalog WHERE id=$1 FOR UPDATE`, [packId]);
      if (!packResult.rowCount || !num(packResult.rows[0].is_active, 0)) throw new PackOpenError('Pack not found or inactive', 404);
      const pack:any = packResult.rows[0];
      const price = num(pack.price);
      if (pack.expires_at && new Date(pack.expires_at) < new Date()) throw new PackOpenError('This pack has expired');

      const quantityLimit = num(pack.quantity_limit);
      const currentQuantity = num(pack.current_quantity);
      if (quantityLimit > 0 && currentQuantity <= 0) throw new PackOpenError('Pack is sold out');

      const cooldownHours = num(pack.cooldown_hours);
      if (cooldownHours > 0) {
        const cooldownResult = await client.query(`SELECT last_opened_at FROM pack_cooldowns WHERE user_id=$1 AND pack_id=$2`, [userId, packId]);
        if (cooldownResult.rows[0]?.last_opened_at) {
          const diff = (Date.now() - new Date(cooldownResult.rows[0].last_opened_at).getTime()) / 3600000;
          if (diff < cooldownHours) throw new PackOpenError(`Cooldown active: ${Math.ceil(cooldownHours - diff)}h remaining`);
        }
      }

      const spendable = num(user.balance) + num(user.matched_balance);
      if (price > spendable) throw new PackOpenError(`Insufficient balance. Need ${price.toFixed(2)}, have ${spendable.toFixed(2)}`);

      const isMysteryPack = (pack.pack_type || 'standard') === 'mystery';
      let cards:any[] = (await client.query(`SELECT * FROM pack_cards WHERE pack_id=$1 ORDER BY sort_order ASC,id ASC`, [packId])).rows;
      if (isMysteryPack) cards = cards.filter((card:any) => num(card.quantity) > 0);
      cards = cards.map((card:any) => ({
        ...card,
        cardName: card.card_name || card.name || 'Unknown Card',
        estimatedValue: num(card.estimated_value ?? card.value),
        cardImageUrl: card.card_image_url || card.image_url || null,
        pullChance: isMysteryPack ? 0 : num(card.pull_chance ?? card.odds),
      }));
      if (isMysteryPack) {
        const totalUnits = cards.reduce((sum:number, card:any) => sum + num(card.quantity), 0);
        cards = cards.map((card:any) => ({ ...card, pullChance: totalUnits > 0 ? (num(card.quantity) / totalUnits) * 100 : 0 }));
      }
      if (!cards.length) throw new PackOpenError(isMysteryPack ? 'This Mystery Pack is sold out' : 'No cards configured for this pack');

      const oddsJson = buildOddsSnapshot(cards);
      const oddsVersionHash = await sha256(oddsJson);
      await client.query(
        `INSERT INTO pack_odds_versions(id,pack_id,version,hash,snapshot,content_hash,odds_json,card_count)
         VALUES(
           $1,$2,COALESCE((SELECT MAX(version)+1 FROM pack_odds_versions WHERE pack_id=$2),1),$3,$4::jsonb,$3,$4::jsonb,$5
         )`,
        [`pov_${uid()}`, packId, oddsVersionHash, oddsJson, cards.length],
      );

      const nonceResult = await client.query(
        `INSERT INTO user_nonces(user_id,nonce,updated_at)
         VALUES($1,1,now())
         ON CONFLICT(user_id) DO UPDATE SET nonce=user_nonces.nonce+1,updated_at=now()
         RETURNING nonce`,
        [userId],
      );
      const nonce = num(nonceResult.rows[0]?.nonce);
      if (!nonce) throw new Error('Provably fair system error — nonce persistence failed. Please try again.');

      const rollValue = await computeRoll(serverSeed, clientSeed, nonce);
      const cardIndex = selectCardIndex(rollValue, cards);
      const picked:any = cards[cardIndex];
      if (!picked) throw new Error('Card selection failed');

      if (isMysteryPack) {
        const claimed = await client.query(`UPDATE pack_cards SET quantity=quantity-1 WHERE id=$1 AND quantity>0 RETURNING id`, [picked.id]);
        if (!claimed.rowCount) throw new PackOpenError('That Mystery Pack card just sold out. Please try again.', 409);
        await client.query(
          `UPDATE packs_catalog
           SET current_quantity=(SELECT COALESCE(SUM(quantity),0) FROM pack_cards WHERE pack_id=$1)
           WHERE id=$1`,
          [packId],
        );
      } else if (quantityLimit > 0) {
        const updated = await client.query(
          `UPDATE packs_catalog SET current_quantity=current_quantity-1 WHERE id=$1 AND current_quantity>0 RETURNING current_quantity`,
          [packId],
        );
        if (!updated.rowCount) throw new PackOpenError('Pack is sold out', 409);
      }

      const cardName = picked.cardName;
      const rarity = picked.rarity || 'common';
      const cardValue = num(picked.estimatedValue);
      const cardImageUrl = picked.cardImageUrl;
      const cardId = `${cardName.toLowerCase().replace(/\s+/g, '_')}_${rarity}`;
      const isBot = user.is_bot === 1 || user.is_bot === true;
      const recipientId = getRewardUserId(userId, isBot);
      const inventoryId = `inv_${uid()}`;

      const walletResult = await processWalletTransactionInClient(client, {
        userId,
        type: 'pack_open',
        amount: -price,
        sourceId: `pack-open:${userId}:${packId}:${nonce}`,
        metadata: { packId, packName:pack.name, cardName, rarity, nonce, clientSeed },
      });
      if (!walletResult.success) throw new PackOpenError(`Failed to deduct balance: ${walletResult.error}`);

      await client.query(
        `INSERT INTO inventory(
          id,user_id,card_id,pack_id,value,locked,favorite,sold,created_at,card_name,rarity,emoji,card_image_url,pack_name,is_locked,is_favorite
        ) VALUES($1,$2,$3,$4,$5,0,0,0,now(),$6,$7,$8,$9,$10,0,0)`,
        [inventoryId, recipientId, cardId, packId, cardValue, cardName, rarity, RARITY_EMOJIS[rarity] || '🃏', cardImageUrl, pack.name],
      );

      await client.query(
        `INSERT INTO pack_cooldowns(user_id,pack_id,last_opened_at)
         VALUES($1,$2,now())
         ON CONFLICT(user_id,pack_id) DO UPDATE SET last_opened_at=EXCLUDED.last_opened_at`,
        [userId, packId],
      );
      await client.query(
        `INSERT INTO packs_opened(
          id,user_id,pack_id,inventory_id,pack_name,cost,card_name,rarity,client_seed,nonce,roll_value,server_seed_hash,odds_version_hash,provably_fair
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1)`,
        [`po_${uid()}`, userId, packId, inventoryId, pack.name, price, cardName, rarity, clientSeed, nonce, rollValue, seedHash, oddsVersionHash],
      );
      await client.query(
        `INSERT INTO transactions(id,user_id,type,amount,matched_amount,description,source_id)
         VALUES($1,$2,'pack_open',$3,0,$4,$5)`,
        [`txn_${uid()}`, userId, -price, `Opened ${pack.name} — pulled ${cardName} (inv:${inventoryId})`, `pack-open:${userId}:${packId}:${nonce}`],
      );
      await client.query(
        `INSERT INTO leaderboard_stats(id,username,biggest_pull,packs_opened,updated_at)
         VALUES($1,$2,$3,1,now())
         ON CONFLICT(id) DO UPDATE SET
           username=EXCLUDED.username,
           biggest_pull=GREATEST(leaderboard_stats.biggest_pull,EXCLUDED.biggest_pull),
           packs_opened=leaderboard_stats.packs_opened+1,
           updated_at=now()`,
        [userId, user.username || user.display_name || 'Trainer', cardValue],
      );

      return {
        user,
        pack,
        price,
        cardName,
        rarity,
        cardValue,
        cardImageUrl,
        inventoryId,
        nonce,
        rollValue,
        walletResult,
      };
    });

    await writeLog(null, {
      type: 'pack_open',
      userId,
      username: result.user.username || result.user.display_name || 'Trainer',
      action: `Opened ${result.pack.name}`,
      details: {
        packName: result.pack.name,
        packCost: result.price,
        cardWon: result.cardName,
        cardValue: result.cardValue,
        rarity: result.rarity,
        packId,
        inventoryId: result.inventoryId,
        nonce: result.nonce,
        rollValue: result.rollValue,
      },
      valueIn: result.price,
      valueOut: result.cardValue,
      result: 'pulled',
    });

    return c.json({
      success: true,
      card: {
        name: result.cardName,
        rarity: result.rarity,
        value: result.cardValue,
        emoji: RARITY_EMOJIS[result.rarity] || '🃏',
        imageUrl: result.cardImageUrl,
      },
      inventoryId: result.inventoryId,
      newBalance: result.walletResult.balanceAfter,
      newMatchedBalance: result.walletResult.matchedAfter,
    });
  } catch (err:any) {
    console.error('[open-pack] error:', err?.message || err);
    if (err instanceof PackOpenError) return c.json({ error: err.message }, err.status as any);
    return c.json({ error: err?.message || 'Internal server error' }, 500);
  }
});

export default app;
