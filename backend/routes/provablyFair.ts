/**
 * Provably Fair Routes — public verification + admin seed management.
 *
 * PUBLIC:
 *   GET  /provably-fair/seed-hash        → current active seed hash (public commitment)
 *   GET  /provably-fair/seed-history      → public seed history (active hash + past revealed)
 *   GET  /provably-fair/my-openings       → user's provably fair pack openings (auth required)
 *   GET  /provably-fair/verify/:openingId  → full verification for a specific opening (auth required)
 *   GET  /provably-fair/my-upgrades        → user's provably fair upgrader spins (auth required)
 *   GET  /provably-fair/verify-upgrade/:spinId → full verification for a specific upgrader spin (auth required)
 *
 * ADMIN:
 *   POST /admin/provably-fair/initialize  → first-time seed setup
 *   POST /admin/provably-fair/rotate      → legacy rotate (kept for compatibility)
 *   GET  /admin/provably-fair/history     → seed rotation history (full admin view)
 *   GET  /admin/provably-fair/status      → current seed status (active + pending info)
 *   POST /admin/provably-fair/generate-seed       → Phase 1: generate new pending seed
 *   POST /admin/provably-fair/complete-rotation   → Phase 2: reveal old, promote pending
 */
import { Hono } from 'hono';
import { getBlinkServer } from '../lib/auth';
import { sha256, computeRoll } from '../lib/provablyFair';

const app = new Hono();

/** Verify a regular user JWT — returns userId or null. */
async function verifyUserToken(c: any): Promise<string | null> {
  const blink = getBlinkServer(c.env as any);
  try {
    const auth = await blink.auth.verifyToken(c.req.header('Authorization'));
    if (auth.valid && auth.userId) return auth.userId;
  } catch { /* not authenticated */ }
  return null;
}

/** Check if request is from an admin */
async function isAdminRequest(c: any): Promise<boolean> {
  const blink = getBlinkServer(c.env as any);

  const adminSecret = c.req.header('X-Admin-Secret');
  if (adminSecret && adminSecret !== 'true') {
    try {
      const rows = await blink.db.adminCredentials.list({});
      const adminRow = rows.find((r: any) => (r.adminPass || r.admin_pass) === adminSecret);
      if (adminRow) return true;
    } catch { /* fall through */ }
  }

  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const auth = await blink.auth.verifyToken(authHeader);
      if (auth.valid && auth.userId) {
        const user = await blink.db.users.get(auth.userId) as any;
        if (user && (user.role === 'admin' || user.role === 'owner')) return true;
      }
    }
  } catch { /* fall through */ }

  return false;
}

/**
 * Generate a cryptographically secure random hex seed (64 chars = 256 bits).
 */
function generateServerSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── PUBLIC ─────────────────────────────────────────────────────

/** Returns the current active (unrevealed) server seed hash. */
app.get('/provably-fair/seed-hash', async (c) => {
  const blink = getBlinkServer(c.env as any);
  try {
    const rows = await blink.db.serverSeeds.list({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      limit: 1,
    }) as any[];
    if (!rows || rows.length === 0) {
      return c.json({ seedHash: null, message: 'No active provably fair seed' });
    }
    return c.json({ seedHash: rows[0].seedHash, activeSince: rows[0].periodStart });
  } catch (err: any) {
    console.error('[provablyFair] seed-hash error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── USER VERIFICATION ──────────────────────────────────────────

/** List a user's provably fair pack openings (auth required). */
app.get('/provably-fair/my-openings', async (c) => {
  const userId = await verifyUserToken(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const rows = await blink.db.packsOpened.list({
      where: { userId, provablyFair: 1 },
      orderBy: { createdAt: 'desc' },
      limit: 50,
    }) as any[];

    return c.json({
      openings: rows.map((r: any) => ({
        id: r.id,
        packName: r.packName || r.pack_name,
        cardName: r.cardName || r.card_name,
        rarity: r.rarity,
        cost: Number(r.cost),
        createdAt: r.createdAt || r.created_at,
        serverSeedHash: r.serverSeedHash || r.server_seed_hash || '',
        oddsVersionHash: r.oddsVersionHash || r.odds_version_hash || '',
      })),
    });
  } catch (err: any) {
    console.error('[provablyFair] my-openings error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Full verification data for a single opening (auth required, own openings only). */
app.get('/provably-fair/verify/:openingId', async (c) => {
  const userId = await verifyUserToken(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const openingId = c.req.param('openingId');
    const opening = await blink.db.packsOpened.get(openingId) as any;
    if (!opening) return c.json({ error: 'Opening not found' }, 404);

    const openerUserId = opening.userId || opening.user_id;
    if (openerUserId !== userId) return c.json({ error: 'Not your opening' }, 403);

    const seedHash = opening.serverSeedHash || opening.server_seed_hash || '';
    const seedRows = await blink.db.serverSeeds.list({
      where: { seedHash },
      limit: 1,
    }) as any[];

    const seed = seedRows[0] || null;
    const isRevealed = seed && (!!seed.revealedSeed || seed.status === 'revealed');
    const revealedSeed = isRevealed ? (seed.revealedSeed || seed.revealed_seed || '') : '';

    let recomputedRoll: number | null = null;
    let verified = false;

    if (isRevealed) {
      const clientSeed = opening.clientSeed || opening.client_seed || '';
      const nonce = Number(opening.nonce || 0);
      if (clientSeed && nonce > 0) {
        try {
          recomputedRoll = await computeRoll(revealedSeed, clientSeed, nonce);
          const storedRoll = Number(opening.rollValue ?? opening.roll_value ?? 0);
          verified = Math.abs(recomputedRoll - storedRoll) < 0.001;
        } catch { /* verification computation failed */ }
      }
    }

    return c.json({
      id: opening.id,
      packName: opening.packName || opening.pack_name,
      cardName: opening.cardName || opening.card_name,
      rarity: opening.rarity,
      cost: Number(opening.cost),
      createdAt: opening.createdAt || opening.created_at,
      clientSeed: opening.clientSeed || opening.client_seed || '',
      nonce: Number(opening.nonce || 0),
      rollValue: Number(opening.rollValue ?? opening.roll_value ?? 0),
      serverSeedHash: seedHash,
      oddsVersionHash: opening.oddsVersionHash || opening.odds_version_hash || '',
      isRevealed,
      revealedSeed: isRevealed ? revealedSeed : undefined,
      verified: isRevealed ? verified : undefined,
      recomputedRoll: recomputedRoll !== null ? recomputedRoll : undefined,
    });
  } catch (err: any) {
    console.error('[provablyFair] verify error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Public seed history — current hash + past revealed seeds (no auth required). */
app.get('/provably-fair/seed-history', async (c) => {
  const blink = getBlinkServer(c.env as any);
  try {
    const activeRows = await blink.db.serverSeeds.list({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      limit: 1,
    }) as any[];

    const pastRows = await blink.db.serverSeeds.list({
      orderBy: { createdAt: 'desc' },
      limit: 50,
    }) as any[];

    const active = activeRows[0] || null;
    const past = pastRows.filter((r: any) => r.status === 'revealed').map((r: any) => ({
      seedHash: r.seedHash,
      revealedSeed: r.revealedSeed || r.revealed_seed || '',
      periodStart: r.periodStart || r.period_start,
      periodEnd: r.periodEnd || r.period_end,
      revealedAt: r.revealedAt || r.revealed_at,
    }));

    return c.json({
      active: active ? {
        seedHash: active.seedHash,
        activeSince: active.periodStart || active.period_start,
      } : null,
      past,
    });
  } catch (err: any) {
    console.error('[provablyFair] seed-history error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── UPDATER VERIFICATION ──────────────────────────────────────

/** List a user's provably fair upgrader spins (auth required). */
app.get('/provably-fair/my-upgrades', async (c) => {
  const userId = await verifyUserToken(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const rows = await blink.db.table('upgraderSpins').list({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      limit: 50,
    }) as any[];

    return c.json({
      spins: rows.map((r: any) => ({
        id: r.id,
        multiplier: Number(r.multiplier || 0),
        totalInputValue: Number(r.totalInputValue || r.total_input_value || 0),
        balanceUsed: Number(r.balanceUsed || r.balance_used || 0),
        totalTargetValue: Number(r.totalTargetValue || r.total_target_value || 0),
        winChance: Number(r.winChance || r.win_chance || 0),
        isWin: Number(r.isWin || r.is_win || 0) > 0,
        serverSeedHash: r.serverSeedHash || r.server_seed_hash || '',
        oddsVersionHash: r.oddsVersionHash || r.odds_version_hash || '',
        createdAt: r.createdAt || r.created_at,
        provablyFair: Number(r.provablyFair ?? r.provably_fair ?? 0) > 0,
      })),
    });
  } catch (err: any) {
    console.error('[provablyFair] my-upgrades error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Full verification data for a single upgrader spin (auth required, own spins only). */
app.get('/provably-fair/verify-upgrade/:spinId', async (c) => {
  const userId = await verifyUserToken(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const spinId = c.req.param('spinId');
    const spin = await blink.db.table('upgraderSpins').get(spinId) as any;
    if (!spin) return c.json({ error: 'Upgrader spin not found' }, 404);

    const spinUserId = spin.userId || spin.user_id;
    if (spinUserId !== userId) return c.json({ error: 'Not your spin' }, 403);

    // Legacy spins (pre-provably-fair) have no verification data
    if (!Number(spin.provablyFair ?? spin.provably_fair ?? 0)) {
      return c.json({
        id: spin.id,
        multiplier: Number(spin.multiplier || 0),
        totalInputValue: Number(spin.totalInputValue || spin.total_input_value || 0),
        isWin: Number(spin.isWin || spin.is_win || 0) > 0,
        createdAt: spin.createdAt || spin.created_at,
        isLegacy: true,
        message: 'This spin predates the provably fair system and cannot be independently verified.',
      });
    }

    // Find the server seed that was active when this spin occurred
    const seedHash = spin.serverSeedHash || spin.server_seed_hash || '';
    const seedRows = await blink.db.serverSeeds.list({
      where: { seedHash },
      limit: 1,
    }) as any[];

    const seed = seedRows[0] || null;
    const isRevealed = seed && (!!seed.revealedSeed || seed.status === 'revealed');
    const revealedSeed = isRevealed ? (seed.revealedSeed || seed.revealed_seed || '') : '';

    let recomputedRoll: number | null = null;
    let verified = false;

    if (isRevealed) {
      const clientSeed = spin.clientSeed || spin.client_seed || '';
      const nonce = Number(spin.nonce || 0);
      if (clientSeed && nonce > 0) {
        try {
          recomputedRoll = await computeRoll(revealedSeed, clientSeed, nonce);
          const storedRoll = Number(spin.rollValue ?? spin.roll_value ?? 0);
          verified = Math.abs(recomputedRoll - storedRoll) < 0.001;
        } catch { /* verification computation failed */ }
      }
    }

    return c.json({
      id: spin.id,
      multiplier: Number(spin.multiplier || 0),
      totalInputValue: Number(spin.totalInputValue || spin.total_input_value || 0),
      balanceUsed: Number(spin.balanceUsed || spin.balance_used || 0),
      baselineTargetValue: Number(spin.baselineTargetValue || spin.baseline_target_value || 0),
      totalTargetValue: Number(spin.totalTargetValue || spin.total_target_value || 0),
      winChance: Number(spin.winChance || spin.win_chance || 0),
      isWin: Number(spin.isWin || spin.is_win || 0) > 0,
      clientSeed: spin.clientSeed || spin.client_seed || '',
      nonce: Number(spin.nonce || 0),
      rollValue: Number(spin.rollValue ?? spin.roll_value ?? 0),
      serverSeedHash: seedHash,
      oddsVersionHash: spin.oddsVersionHash || spin.odds_version_hash || '',
      wonCardsJson: spin.wonCardsJson || spin.won_cards_json || '[]',
      removedCardIdsJson: spin.removedCardIdsJson || spin.removed_card_ids_json || '[]',
      createdAt: spin.createdAt || spin.created_at,
      isRevealed,
      revealedSeed: isRevealed ? revealedSeed : undefined,
      verified: isRevealed ? verified : undefined,
      recomputedRoll: recomputedRoll !== null ? recomputedRoll : undefined,
      isLegacy: false,
    });
  } catch (err: any) {
    console.error('[provablyFair] verify-upgrade error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── ADMIN ──────────────────────────────────────────────────────

/** Initialize the first server seed (admin only). Idempotent. */
app.post('/admin/provably-fair/initialize', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const existing = await blink.db.serverSeeds.list({
      where: { status: 'active' },
      limit: 1,
    }) as any[];

    if (existing.length > 0) {
      return c.json({
        success: true,
        message: 'Active seed already exists. No action taken.',
        seedHash: existing[0].seedHash,
        activeSince: existing[0].periodStart,
      });
    }

    const seed = generateServerSeed();
    const hash = await sha256(seed);
    const now = new Date().toISOString();
    const id = `seed_${Date.now()}`;

    await blink.db.serverSeeds.create({
      id,
      seedHash: hash,
      periodStart: now,
      revealedSeed: null,
      revealedAt: null,
      status: 'active',
    });

    console.log(`[provablyFair] Seed initialized: ${hash}`);
    console.log(`[provablyFair] SEED VALUE (store securely): ${seed}`);

    return c.json({
      success: true,
      message: 'Server seed initialized.',
      seedHash: hash,
      seed, // Return once so admin can store it
    });
  } catch (err: any) {
    console.error('[provablyFair] initialize error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Phase 1: Generate a new pending seed.
 *
 * - If a pending seed already exists, returns it (idempotent).
 * - Otherwise: generates a new 256-bit seed, stores it as status='pending',
 *   and returns the seed value ONE TIME along with its hash.
 * - The admin must copy this seed into the BLINK_SERVER_SEED env var
 *   BEFORE calling complete-rotation.
 */
app.post('/admin/provably-fair/generate-seed', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    // Check for existing pending seed
    const pendingRows = await blink.db.serverSeeds.list({
      where: { status: 'pending' },
      limit: 1,
    }) as any[];

    if (pendingRows.length > 0) {
      const pending = pendingRows[0];
      // Pending seed value was not persisted — admin must have copied it.
      // Return hash only (the seed itself was shown when first generated).
      return c.json({
        success: true,
        message: 'A pending seed already exists. Complete rotation first.',
        seedHash: pending.seedHash,
        alreadyPending: true,
      });
    }

    // Generate new seed
    const seed = generateServerSeed();
    const hash = await sha256(seed);
    const now = new Date().toISOString();
    const id = `seed_${Date.now()}`;

    // Store as pending with the seed hash (never persist the raw seed value)
    await blink.db.serverSeeds.create({
      id,
      seedHash: hash,
      periodStart: now,
      revealedSeed: null,
      revealedAt: null,
      status: 'pending',
    });

    console.log(`[provablyFair] New pending seed generated: ${hash}`);
    console.log(`[provablyFair] PENDING SEED VALUE (copy to BLINK_SERVER_SEED): ${seed}`);

    return c.json({
      success: true,
      message: 'New pending seed generated. Copy the seed value and update BLINK_SERVER_SEED.',
      seedHash: hash,
      seed, // ONE-TIME return — admin must copy now
    });
  } catch (err: any) {
    console.error('[provablyFair] generate-seed error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Phase 2: Complete the rotation.
 *
 * - Requires oldSeed in the body — proves admin knows the currently active seed.
 * - Verifies SHA-256(oldSeed) matches the current active seed's hash.
 * - Reveals the old seed (stores it in DB), marks it status='revealed'.
 * - Promotes the pending seed to active.
 * - If no pending seed exists, generates and activates one in a single step
 *   (fallback for the legacy rotate flow).
 */
app.post('/admin/provably-fair/complete-rotation', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const body = await c.req.json();
    const { oldSeed } = body;

    if (!oldSeed || typeof oldSeed !== 'string') {
      return c.json({ error: 'oldSeed is required' }, 400);
    }

    // Find active seed
    const activeRows = await blink.db.serverSeeds.list({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      limit: 1,
    }) as any[];

    if (activeRows.length === 0) {
      return c.json({ error: 'No active seed found. Run initialize first.' }, 400);
    }

    const activeSeed = activeRows[0];

    // Verify old seed matches active hash
    const computedHash = await sha256(oldSeed);
    if (computedHash !== activeSeed.seedHash) {
      return c.json({
        error: 'The provided seed does not match the current active seed hash.',
        expectedHash: activeSeed.seedHash,
      }, 400);
    }

    // Find pending seed
    const pendingRows = await blink.db.serverSeeds.list({
      where: { status: 'pending' },
      limit: 1,
    }) as any[];

    const now = new Date().toISOString();

    // Reveal old seed
    await blink.db.serverSeeds.update(activeSeed.id, {
      revealedSeed: oldSeed,
      revealedAt: now,
      periodEnd: now,
      status: 'revealed',
    });

    if (pendingRows.length > 0) {
      // Promote pending to active
      await blink.db.serverSeeds.update(pendingRows[0].id, {
        status: 'active',
      });
      console.log(`[provablyFair] Rotation complete. Old (${activeSeed.seedHash}) revealed. Pending (${pendingRows[0].seedHash}) promoted to active.`);

      return c.json({
        success: true,
        message: 'Rotation complete. Old seed revealed, pending seed is now active.',
        oldSeedHash: activeSeed.seedHash,
        newSeedHash: pendingRows[0].seedHash,
      });
    } else {
      // No pending seed — generate one now (legacy/fallback path)
      const newSeed = generateServerSeed();
      const newHash = await sha256(newSeed);
      const newId = `seed_${Date.now()}`;

      await blink.db.serverSeeds.create({
        id: newId,
        seedHash: newHash,
        periodStart: now,
        revealedSeed: null,
        revealedAt: null,
        status: 'active',
      });

      console.log(`[provablyFair] Rotation complete (fallback). Old (${activeSeed.seedHash}) revealed. New active: ${newHash}`);
      console.log(`[provablyFair] NEW ACTIVE SEED VALUE (copy to BLINK_SERVER_SEED): ${newSeed}`);

      return c.json({
        success: true,
        message: 'Rotation complete. Old seed revealed, new active seed generated.',
        oldSeedHash: activeSeed.seedHash,
        newSeedHash: newHash,
        newSeed, // ONE-TIME — admin must copy to BLINK_SERVER_SEED
      });
    }
  } catch (err: any) {
    console.error('[provablyFair] complete-rotation error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Legacy rotate endpoint — kept for backward compatibility but prefers two-phase flow. */
app.post('/admin/provably-fair/rotate', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const activeRows = await blink.db.serverSeeds.list({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      limit: 1,
    }) as any[];

    if (activeRows.length === 0) {
      return c.json({ error: 'No active seed to rotate. Run initialize first.' }, 400);
    }

    const oldSeed = activeRows[0];
    const now = new Date().toISOString();

    const revealedSeed = c.req.header('X-Reveal-Seed');
    if (!revealedSeed) {
      // If no X-Reveal-Seed, fall through to body
    }

    const effectiveOldSeed: string = revealedSeed || '';

    // Validate that the revealed seed matches the stored hash
    const computedHash = await sha256(effectiveOldSeed);
    if (computedHash !== oldSeed.seedHash) {
      return c.json({ error: 'Provided seed does not match the active seed hash.' }, 400);
    }

    // Check if there's a pending seed to promote
    const pendingRows = await blink.db.serverSeeds.list({
      where: { status: 'pending' },
      limit: 1,
    }) as any[];

    // Reveal old seed
    await blink.db.serverSeeds.update(oldSeed.id, {
      revealedSeed: effectiveOldSeed,
      revealedAt: now,
      periodEnd: now,
      status: 'revealed',
    });

    if (pendingRows.length > 0) {
      await blink.db.serverSeeds.update(pendingRows[0].id, { status: 'active' });
      return c.json({
        success: true,
        message: 'Seed rotated successfully.',
        oldSeedHash: oldSeed.seedHash,
        newSeedHash: pendingRows[0].seedHash,
      });
    }

    // Fallback: create new active seed immediately
    const newSeed = generateServerSeed();
    const newHash = await sha256(newSeed);
    const newId = `seed_${Date.now()}`;

    await blink.db.serverSeeds.create({
      id: newId,
      seedHash: newHash,
      periodStart: now,
      revealedSeed: null,
      revealedAt: null,
      status: 'active',
    });

    console.log(`[provablyFair] Seed rotated. Old: ${oldSeed.seedHash} revealed. New: ${newHash}`);
    console.log(`[provablyFair] NEW SEED VALUE (store securely): ${newSeed}`);

    return c.json({
      success: true,
      message: 'Seed rotated successfully.',
      oldSeedHash: oldSeed.seedHash,
      newSeedHash: newHash,
      newSeed,
    });
  } catch (err: any) {
    console.error('[provablyFair] rotate error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Admin seed status — returns active, pending, and past seeds. */
app.get('/admin/provably-fair/status', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const [activeRows, pendingRows, allRows] = await Promise.all([
      blink.db.serverSeeds.list({ where: { status: 'active' }, orderBy: { createdAt: 'desc' }, limit: 1 }),
      blink.db.serverSeeds.list({ where: { status: 'pending' }, limit: 1 }),
      blink.db.serverSeeds.list({ orderBy: { createdAt: 'desc' }, limit: 50 }),
    ]) as [any[], any[], any[]];

    const revealedRows = allRows.filter((r: any) => r.status === 'revealed');

    return c.json({
      active: activeRows[0] ? {
        id: activeRows[0].id,
        seedHash: activeRows[0].seedHash,
        periodStart: activeRows[0].periodStart || activeRows[0].period_start,
      } : null,
      pending: pendingRows[0] ? {
        id: pendingRows[0].id,
        seedHash: pendingRows[0].seedHash,
        periodStart: pendingRows[0].periodStart || pendingRows[0].period_start,
      } : null,
      past: revealedRows.map((r: any) => ({
        id: r.id,
        seedHash: r.seedHash,
        periodStart: r.periodStart || r.period_start,
        periodEnd: r.periodEnd || r.period_end,
        revealedAt: r.revealedAt || r.revealed_at,
        revealedSeed: r.revealedSeed || r.revealed_seed || '',
      })),
    });
  } catch (err: any) {
    console.error('[provablyFair] status error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

/** Seed rotation history (admin only). */
app.get('/admin/provably-fair/history', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ error: 'Unauthorized' }, 401);

  const blink = getBlinkServer(c.env as any);
  try {
    const rows = await blink.db.serverSeeds.list({
      orderBy: { createdAt: 'desc' },
      limit: 50,
    }) as any[];

    return c.json({
      seeds: rows.map((r) => ({
        id: r.id,
        seedHash: r.seedHash,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        isActive: r.status === 'active',
        isPending: r.status === 'pending',
        isRevealed: r.status === 'revealed',
        revealedAt: r.revealedAt,
      })),
    });
  } catch (err: any) {
    console.error('[provablyFair] history error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
