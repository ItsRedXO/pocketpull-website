import { getDb, type DbEnv } from '../client';
import { type PackCatalog, type PackCard } from './packs';

export interface FinalizePackOpenInput {
  userId: string;
  recipientId: string;
  pack: PackCatalog;
  card: PackCard;
  inventoryId: string;
  packOpeningId: string;
  walletTransactionId: string;
  transactionId: string;
  clientSeed: string;
  nonce: number;
  rollValue: number;
  serverSeedHash: string;
  oddsVersionHash: string;
  emoji: string;
  now: Date;
}

export interface FinalizePackOpenResult {
  success: boolean;
  error?: string;
  conflict?: boolean;
  balanceAfter?: number;
  matchedAfter?: number;
}

export async function finalizePackOpen(
  env: DbEnv,
  input: FinalizePackOpenInput,
): Promise<FinalizePackOpenResult> {
  const client = await getDb(env).connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ balance: string; matched_balance: string; is_deleted: boolean; is_banned: boolean }>(
      `SELECT balance, matched_balance, is_deleted, is_banned
         FROM users WHERE id = $1 FOR UPDATE`,
      [input.userId],
    );
    const user = userResult.rows[0];
    if (!user) throw new Error('User not found');
    if (user.is_deleted) throw new Error('Account deactivated');
    if (user.is_banned) throw new Error('Account banned');

    const spendable = Number(user.balance) + Number(user.matched_balance);
    if (spendable < input.pack.price) throw new Error('Insufficient balance');

    const packResult = await client.query<{ quantity_limit: number; current_quantity: number; cooldown_hours: number; expires_at: string | null; pack_type: string }>(
      `SELECT quantity_limit, current_quantity, cooldown_hours, expires_at, pack_type
         FROM packs_catalog WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
      [input.pack.id],
    );
    const pack = packResult.rows[0];
    if (!pack) throw new Error('Pack not found or inactive');
    if (pack.expires_at && new Date(pack.expires_at) < input.now) throw new Error('This pack has expired');
    if (Number(pack.quantity_limit) > 0 && Number(pack.current_quantity) <= 0) throw new Error('Pack is sold out');

    const cooldown = await client.query<{ last_opened_at: string }>(
      `SELECT last_opened_at FROM pack_cooldowns WHERE user_id = $1 AND pack_id = $2 FOR UPDATE`,
      [input.userId, input.pack.id],
    );
    if (cooldown.rows[0] && Number(pack.cooldown_hours) > 0) {
      const elapsed = input.now.getTime() - new Date(cooldown.rows[0].last_opened_at).getTime();
      if (elapsed < Number(pack.cooldown_hours) * 3600000) throw new Error(`Cooldown active: ${Math.ceil((Number(pack.cooldown_hours) * 3600000 - elapsed) / 3600000)}h remaining`);
    }

    let selectedCard = input.card;
    if (input.pack.packType === 'mystery') {
      const cardResult = await client.query<PackCard & { quantity: number }>(
        `SELECT id, pack_id, card_name, rarity, pull_chance, estimated_value, card_image_url, sort_order, quantity, original_quantity
           FROM pack_cards WHERE id = $1 AND pack_id = $2 AND COALESCE(quantity, 0) > 0 FOR UPDATE`,
        [input.card.id, input.pack.id],
      );
      if (!cardResult.rows[0]) {
        await client.query('ROLLBACK');
        return { success: false, conflict: true, error: 'That Mystery Pack card just sold out. Please try again.' };
      }
      selectedCard = cardResult.rows[0] as PackCard;
      await client.query(`UPDATE pack_cards SET quantity = quantity - 1 WHERE id = $1`, [selectedCard.id]);
      await client.query(
        `UPDATE packs_catalog SET current_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM pack_cards WHERE pack_id = $1) WHERE id = $1`,
        [input.pack.id],
      );
    } else if (Number(pack.quantity_limit) > 0) {
      await client.query(`UPDATE packs_catalog SET current_quantity = GREATEST(0, current_quantity - 1) WHERE id = $1`, [input.pack.id]);
    }

    const debit = input.pack.price;
    const balanceBefore = Number(user.balance);
    const matchedBefore = Number(user.matched_balance);
    const matchedSpent = Math.min(matchedBefore, debit);
    const matchedAfter = matchedBefore - matchedSpent;
    const balanceAfter = balanceBefore - (debit - matchedSpent);

    await client.query(
      `UPDATE users SET balance = $2, matched_balance = $3, updated_at = $4 WHERE id = $1`,
      [input.userId, balanceAfter, matchedAfter, input.now],
    );

    await client.query(
      `INSERT INTO inventory (id, user_id, card_id, card_name, rarity, value, emoji, is_favorite, created_at, card_image_url, pack_name, is_locked, battle_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9,$10,FALSE,NULL)`,
      [input.inventoryId, input.recipientId, `${selectedCard.cardName.toLowerCase().replace(/\s+/g, '_')}_${selectedCard.rarity || 'common'}`, selectedCard.cardName, selectedCard.rarity || 'common', selectedCard.estimatedValue, input.emoji, input.now, selectedCard.cardImageUrl, input.pack.name],
    );

    await client.query(
      `INSERT INTO wallet_transactions (id,user_id,type,amount,balance_before,balance_after,matched_before,matched_after,source_id,metadata,created_at)
       VALUES ($1,$2,'pack_open',$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [input.walletTransactionId, input.userId, -debit, balanceBefore, balanceAfter, matchedBefore, matchedAfter, input.inventoryId, JSON.stringify({ packId: input.pack.id }), input.now],
    );

    await client.query(
      `INSERT INTO transactions (id,user_id,type,amount,description,created_at)
       VALUES ($1,$2,'pack_open',$3,$4,$5)`,
      [input.transactionId, input.userId, -debit, `Opened ${input.pack.name} — pulled ${selectedCard.cardName} (inv:${input.inventoryId})`, input.now],
    );

    await client.query(
      `INSERT INTO packs_opened (id,user_id,pack_id,pack_name,cost,created_at,card_name,rarity,client_seed,nonce,roll_value,odds_version_hash,server_seed_hash,provably_fair)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)`,
      [input.packOpeningId, input.userId, input.pack.id, input.pack.name, debit, input.now, selectedCard.cardName, selectedCard.rarity || 'common', input.clientSeed, input.nonce, input.rollValue, input.oddsVersionHash, input.serverSeedHash],
    );

    await client.query(
      `INSERT INTO pack_cooldowns (id,user_id,pack_id,last_opened_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, pack_id) DO UPDATE SET last_opened_at = EXCLUDED.last_opened_at`,
      [`${input.userId}_${input.pack.id}`, input.userId, input.pack.id, input.now],
    );

    await client.query('COMMIT');
    return { success: true, balanceAfter, matchedAfter };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    return { success: false, error: err?.message || 'Failed to finalize pack opening' };
  } finally {
    client.release();
  }
}
