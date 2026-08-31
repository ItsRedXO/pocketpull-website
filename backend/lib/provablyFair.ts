/**
 * Provably Fair RNG — HMAC-SHA256 deterministic roll system.
 *
 * Algorithm: roll = HMAC-SHA256(serverSeed, clientSeed + ":" + nonce)
 *            → first 8 hex chars → uint32 → modulo 1,000,000 → / 10,000
 *            → yields float 0.0000–99.9999 with 4 decimal places
 *
 * Verification: given (serverSeed, clientSeed, nonce, odds snapshot),
 * anyone can recompute the exact roll and replay the card selection.
 *
 * All crypto functions use the Web Crypto API (available in CF Workers).
 */

/** SHA-256 hex digest. Used for seed hashing and odds content hashing. */
export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute a deterministic roll (0.0000–99.9999) from seeds + nonce.
 */
export async function computeRoll(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<number> {
  const message = `${clientSeed}:${nonce}`;
  const enc = new TextEncoder();

  // HMAC-SHA256 using Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const hashHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Take first 8 hex chars → unsigned 32-bit integer
  const uint32 = parseInt(hashHex.slice(0, 8), 16) >>> 0;
  // Scale to 0–99.9999 (4 decimal places)
  const roll = (uint32 % 1_000_000) / 10_000;
  return Math.round(roll * 10_000) / 10_000;
}

/**
 * Build a stable, sorted JSON snapshot of pack odds suitable for hashing.
 * Sorting by cardName ensures the same logical odds always produce the same hash.
 */
export function buildOddsSnapshot(dbCards: any[]): string {
  const normalized = dbCards.map((c) => ({
    cardName: c.cardName || c.card_name || 'Unknown',
    rarity: c.rarity || 'common',
    pullChance: Number(c.pullChance ?? c.pull_chance ?? 0),
    estimatedValue: Number(c.estimatedValue ?? c.estimated_value ?? 0),
  }));
  // Sort by cardName for deterministic ordering
  normalized.sort((a, b) => a.cardName.localeCompare(b.cardName));
  return JSON.stringify(normalized);
}

/**
 * Deterministic card selection: given a roll (0–100) and a card pool,
 * use cumulative pullChance to pick a card.
 * Returns the index in dbCards so the caller can access all fields.
 */
export function selectCardIndex(roll: number, dbCards: any[]): number {
  let cumulative = 0;
  for (let i = 0; i < dbCards.length; i++) {
    const chance = Number(dbCards[i].pullChance ?? dbCards[i].pull_chance ?? 0);
    cumulative += chance;
    if (roll <= cumulative) {
      return i;
    }
  }
  // Fallback to last card (shouldn't happen if odds sum to 100)
  return dbCards.length - 1;
}
