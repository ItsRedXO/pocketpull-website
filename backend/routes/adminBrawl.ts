import { Hono } from 'hono';
import { requireAuth } from '../lib/auth';
import { query } from '../lib/postgres';
import { isAdminSecretCandidate } from '../lib/adminAuthorization';
import { computeOverallRating } from '../lib/brawl/rating';
import {
  listAllSpecies, updateSpecies, searchBrawlUsers, getOrCreateProfile, getWalletBalance, listInstancesForUser,
  adminSetProfileFields, applyBrawlWalletTransaction, insertInstances, adminDeleteInstance, setTeam,
} from '../repositories/brawl';
import {
  listAllItems, adminCreateItem, adminUpdateItem, adminDeleteItem,
  adminGetShopStatus, adminSetShopSlate, adminRegenerateNextShop, adminRotateShopNow,
} from '../repositories/brawlItems';
import {
  adminListChallengeTemplates, adminCreateChallengeTemplate, adminUpdateChallengeTemplate, adminDeleteChallengeTemplate,
} from '../repositories/brawlChallenges';

const app = new Hono();

async function requireAdmin(c: any): Promise<string> {
  const secret = c.req.header('X-Admin-Secret');
  if (isAdminSecretCandidate(secret)) {
    const rows = await query<{ id: string }>('SELECT id FROM admin_credentials WHERE admin_pass=$1 LIMIT 1', [secret]);
    if (rows[0]?.id) return rows[0].id;
  }
  const userId = await requireAuth(c);
  const rows = await query<{ role: string; is_admin: number }>('SELECT role,is_admin FROM users WHERE id=$1 LIMIT 1', [userId]);
  const user = rows[0];
  if (user?.role !== 'admin' && user?.role !== 'owner' && Number(user?.is_admin || 0) !== 1) throw new Error('FORBIDDEN');
  return userId;
}
async function admin(c: any) { try { return await requireAdmin(c); } catch { return c.json({ error: 'Admin access required' }, 403); } }

app.get('/admin/brawl/species', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ species: await listAllSpecies() });
});

app.patch('/admin/brawl/species/:id', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid species id' }, 400);
  const body = await c.req.json().catch(() => ({}));

  const fields: Record<string, unknown> = {};
  for (const key of ['name', 'primary_type', 'secondary_type', 'sprite_url', 'artwork_url'] as const) {
    if (body[key] !== undefined) fields[key] = body[key] || null;
  }
  if (body.card_tier_override !== undefined) {
    const value = body.card_tier_override || null;
    if (value !== null && !['bronze', 'silver', 'gold', 'legendary'].includes(value)) {
      return c.json({ error: 'card_tier_override must be bronze, silver, gold, legendary, or null' }, 400);
    }
    fields.card_tier_override = value;
  }
  const statFields = ['base_hp', 'base_attack', 'base_defense', 'base_sp_attack', 'base_sp_defense', 'base_speed'] as const;
  let statsChanged = false;
  for (const key of statFields) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = Math.round(value);
      statsChanged = true;
    }
  }
  if (body.overall_rating !== undefined) {
    const value = Number(body.overall_rating);
    if (!Number.isFinite(value) || value < 0) return c.json({ error: 'Invalid overall_rating' }, 400);
    fields.overall_rating = Math.round(value);
  }
  for (const key of ['portrait_scale', 'portrait_offset_x', 'portrait_offset_y'] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value)) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = value;
    }
  }
  if (body.overall_rating === undefined && statsChanged) {
    const current = (await listAllSpecies()).find(s => s.id === id);
    if (current) {
      const merged = { ...current, ...fields } as any;
      fields.overall_rating = computeOverallRating({
        hp: merged.base_hp, attack: merged.base_attack, defense: merged.base_defense,
        spAttack: merged.base_sp_attack, spDefense: merged.base_sp_defense, speed: merged.base_speed,
      });
    }
  }

  const updated = await updateSpecies(id, fields);
  if (!updated) return c.json({ error: 'Species not found' }, 404);
  return c.json({ success: true, species: updated });
});

app.get('/admin/brawl/users', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const search = c.req.query('search') || '';
  return c.json({ users: await searchBrawlUsers(search) });
});

app.get('/admin/brawl/users/:userId', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const rows = await query<{ id: string; username: string | null; avatar_url: string | null }>('SELECT id, username, avatar_url FROM users WHERE id=$1', [userId]);
  if (!rows[0]) return c.json({ error: 'User not found' }, 404);
  const [profile, balance, roster] = await Promise.all([getOrCreateProfile(userId), getWalletBalance(userId), listInstancesForUser(userId)]);
  return c.json({ user: rows[0], profile, balance, roster });
});

const PROFILE_NUMBER_FIELDS = ['league_rating', 'wins', 'losses', 'local_battles_played', 'local_tournament_wins', 'state_tournament_wins', 'regional_tournament_wins', 'elite_four_wins'] as const;
app.patch('/admin/brawl/users/:userId/profile', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  for (const key of PROFILE_NUMBER_FIELDS) {
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return c.json({ error: `Invalid value for ${key}` }, 400);
      fields[key] = Math.round(value);
    }
  }
  if (body.has_completed_intro !== undefined) fields.has_completed_intro = body.has_completed_intro ? 1 : 0;
  if (body.league !== undefined) fields.league = String(body.league);
  const profile = await adminSetProfileFields(userId, fields);
  return c.json({ success: true, profile });
});

app.post('/admin/brawl/users/:userId/wallet', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { amount, reason } = await c.req.json().catch(() => ({}));
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) return c.json({ error: 'amount must be a non-zero number' }, 400);
  try {
    const result = await applyBrawlWalletTransaction(userId, 'admin_adjustment', Math.round(delta), `admin:${adminId}:${Date.now()}`, { adminId, reason: reason || null });
    return c.json({ success: true, balance: result.balanceAfter });
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_POKEDOLLARS') return c.json({ error: 'That would take the balance below 0' }, 400);
    throw e;
  }
});

app.post('/admin/brawl/users/:userId/instances', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { speciesId } = await c.req.json().catch(() => ({}));
  const id = Number(speciesId);
  if (!Number.isInteger(id)) return c.json({ error: 'speciesId is required' }, 400);
  const species = await listAllSpecies();
  if (!species.some(s => s.id === id)) return c.json({ error: 'Unknown species id' }, 404);
  const [instanceId] = await insertInstances(userId, [id], 'admin');
  return c.json({ success: true, instanceId, roster: await listInstancesForUser(userId) });
});

app.delete('/admin/brawl/users/:userId/instances/:instanceId', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const deleted = await adminDeleteInstance(userId, c.req.param('instanceId'));
  if (!deleted) return c.json({ error: 'Pokemon not found on this trainer' }, 404);
  return c.json({ success: true, roster: await listInstancesForUser(userId) });
});

app.put('/admin/brawl/users/:userId/team', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const userId = c.req.param('userId');
  const { instanceIds } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(instanceIds) || instanceIds.length < 1 || instanceIds.length > 6) return c.json({ error: 'Select 1-6 Pokemon for the active team' }, 400);
  try { await setTeam(userId, instanceIds); } catch (e: any) { return c.json({ error: e.message === 'INVALID_TEAM_SELECTION' ? 'One or more selected Pokemon are not owned by this trainer' : 'Failed to update team' }, 400); }
  return c.json({ success: true, roster: await listInstancesForUser(userId) });
});

// ---- Items -----------------------------------------------------------

const ITEM_RARITIES = ['common', 'uncommon', 'rare'];
const ITEM_KINDS = ['stone', 'held', 'other'];
const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

app.get('/admin/brawl/items', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ items: await listAllItems() });
});

app.post('/admin/brawl/items', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const key = String(body.key || '').trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) return c.json({ error: 'key must be lowercase kebab-case, e.g. fire-stone' }, 400);
  if (!body.name) return c.json({ error: 'name is required' }, 400);
  if (!body.description) return c.json({ error: 'description is required' }, 400);
  if (!ITEM_RARITIES.includes(body.rarity)) return c.json({ error: 'rarity must be common, uncommon, or rare' }, 400);
  if (body.kind !== undefined && !ITEM_KINDS.includes(body.kind)) return c.json({ error: 'kind must be stone, held, or other' }, 400);
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return c.json({ error: 'Invalid price' }, 400);
  try {
    const item = await adminCreateItem({
      key, name: body.name, description: body.description, rarity: body.rarity, kind: body.kind,
      price: Math.round(price), sprite_url: body.spriteUrl ?? body.sprite_url ?? null, active: !!body.active,
    });
    return c.json({ success: true, item });
  } catch (e: any) {
    if (String(e.message || '').includes('duplicate key')) return c.json({ error: 'An item with that key already exists' }, 409);
    throw e;
  }
});

app.patch('/admin/brawl/items/:key', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.description !== undefined) fields.description = body.description;
  if (body.rarity !== undefined) {
    if (!ITEM_RARITIES.includes(body.rarity)) return c.json({ error: 'rarity must be common, uncommon, or rare' }, 400);
    fields.rarity = body.rarity;
  }
  if (body.kind !== undefined) {
    if (!ITEM_KINDS.includes(body.kind)) return c.json({ error: 'kind must be stone, held, or other' }, 400);
    fields.kind = body.kind;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return c.json({ error: 'Invalid price' }, 400);
    fields.price = Math.round(price);
  }
  if (body.spriteUrl !== undefined || body.sprite_url !== undefined) fields.sprite_url = body.spriteUrl ?? body.sprite_url ?? null;
  if (body.active !== undefined) fields.active = !!body.active;
  const item = await adminUpdateItem(c.req.param('key'), fields);
  if (!item) return c.json({ error: 'Item not found' }, 404);
  return c.json({ success: true, item });
});

app.delete('/admin/brawl/items/:key', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  try {
    await adminDeleteItem(c.req.param('key'));
    return c.json({ success: true });
  } catch (e: any) {
    if (e.code === '23503' || String(e.message || '').includes('foreign key')) return c.json({ error: 'Players already own this item -- deactivate it instead of deleting' }, 409);
    throw e;
  }
});

app.get('/admin/brawl/items/shop', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json(await adminGetShopStatus());
});

app.put('/admin/brawl/items/shop/:slate', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const slate = c.req.param('slate');
  if (slate !== 'current' && slate !== 'next') return c.json({ error: 'slate must be current or next' }, 400);
  const { itemKeys } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(itemKeys) || itemKeys.some((k: unknown) => typeof k !== 'string')) return c.json({ error: 'itemKeys must be an array of item keys' }, 400);
  try {
    await adminSetShopSlate(slate, itemKeys);
  } catch (e: any) {
    const messages: Record<string, string> = { UNKNOWN_ITEM: 'One or more item keys are unknown', ITEM_NOT_ACTIVE: 'Every item placed in the shop must be active' };
    return c.json({ error: messages[e.message] || 'Failed to update shop' }, 400);
  }
  return c.json(await adminGetShopStatus());
});

app.post('/admin/brawl/items/shop/next/regenerate', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  await adminRegenerateNextShop();
  return c.json(await adminGetShopStatus());
});

app.post('/admin/brawl/items/shop/rotate-now', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  await adminRotateShopNow();
  return c.json(await adminGetShopStatus());
});

// ---- Challenges --------------------------------------------------------

const CHALLENGE_TYPES = ['win_matches', 'win_tournament', 'evolve_pokemon', 'open_safari', 'win_mono_type'];
const REWARD_KINDS = ['pokedollars', 'pokemon'];

function validateChallengeBody(body: any, isCreate: boolean): { error?: string; fields: Record<string, unknown> } {
  const fields: Record<string, unknown> = {};
  if (isCreate) {
    const key = String(body.key || '').trim().toLowerCase();
    if (!KEY_PATTERN.test(key)) return { error: 'key must be lowercase kebab-case, e.g. win-5-battles', fields };
    fields.key = key;
  }
  if (body.type !== undefined) {
    if (!CHALLENGE_TYPES.includes(body.type)) return { error: `type must be one of ${CHALLENGE_TYPES.join(', ')}`, fields };
    fields.type = body.type;
  } else if (isCreate) return { error: 'type is required', fields };

  if (body.label !== undefined) fields.label = body.label;
  else if (isCreate) return { error: 'label is required', fields };

  if (body.description !== undefined) fields.description = body.description;
  else if (isCreate) return { error: 'description is required', fields };

  if (body.target !== undefined) {
    const target = Number(body.target);
    if (!Number.isInteger(target) || target < 1) return { error: 'target must be a positive integer', fields };
    fields.target = target;
  } else if (isCreate) return { error: 'target is required', fields };

  const rewardKindRaw = body.reward_kind ?? body.rewardKind;
  if (rewardKindRaw !== undefined) {
    if (!REWARD_KINDS.includes(rewardKindRaw)) return { error: `reward_kind must be one of ${REWARD_KINDS.join(', ')}`, fields };
    fields.reward_kind = rewardKindRaw;
  }
  const amountRaw = body.reward_amount ?? body.rewardAmount;
  if (amountRaw !== undefined) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) return { error: 'Invalid reward_amount', fields };
    fields.reward_amount = Math.round(amount);
  }
  const minRaw = body.reward_overall_min ?? body.rewardOverallMin;
  if (minRaw !== undefined) {
    const min = Number(minRaw);
    if (!Number.isFinite(min) || min < 1) return { error: 'Invalid reward_overall_min', fields };
    fields.reward_overall_min = Math.round(min);
  }
  const maxRaw = body.reward_overall_max ?? body.rewardOverallMax;
  if (maxRaw !== undefined) {
    const max = Number(maxRaw);
    if (!Number.isFinite(max) || max < 1) return { error: 'Invalid reward_overall_max', fields };
    fields.reward_overall_max = Math.round(max);
  }
  if (fields.reward_overall_min != null && fields.reward_overall_max != null && (fields.reward_overall_max as number) < (fields.reward_overall_min as number)) {
    return { error: 'reward_overall_max must be >= reward_overall_min', fields };
  }

  if (isCreate) {
    if (fields.reward_kind === undefined) return { error: 'reward_kind is required', fields };
    if (fields.reward_kind === 'pokedollars' && fields.reward_amount === undefined) return { error: 'reward_amount is required for pokedollar rewards', fields };
    if (fields.reward_kind === 'pokemon' && (fields.reward_overall_min === undefined || fields.reward_overall_max === undefined)) {
      return { error: 'reward_overall_min and reward_overall_max are required for pokemon rewards', fields };
    }
  }

  const fixedTypeRaw = body.fixed_type ?? body.fixedType;
  if (fixedTypeRaw !== undefined) fields.fixed_type = fixedTypeRaw || null;
  if (body.active !== undefined) fields.active = !!body.active;
  return { fields };
}

app.get('/admin/brawl/challenges', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  return c.json({ templates: await adminListChallengeTemplates() });
});

app.post('/admin/brawl/challenges', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const { error, fields } = validateChallengeBody(body, true);
  if (error) return c.json({ error }, 400);
  try {
    const template = await adminCreateChallengeTemplate(fields);
    return c.json({ success: true, template });
  } catch (e: any) {
    if (String(e.message || '').includes('duplicate key')) return c.json({ error: 'A challenge with that key already exists' }, 409);
    throw e;
  }
});

app.patch('/admin/brawl/challenges/:key', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  const body = await c.req.json().catch(() => ({}));
  const { error, fields } = validateChallengeBody(body, false);
  if (error) return c.json({ error }, 400);
  const template = await adminUpdateChallengeTemplate(c.req.param('key'), fields);
  if (!template) return c.json({ error: 'Challenge template not found' }, 404);
  return c.json({ success: true, template });
});

app.delete('/admin/brawl/challenges/:key', async c => {
  const adminId = await admin(c); if (typeof adminId !== 'string') return adminId;
  await adminDeleteChallengeTemplate(c.req.param('key'));
  return c.json({ success: true });
});

export default app;
