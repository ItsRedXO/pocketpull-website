import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateServerSeed } from './lib/provablyFairServerSeed';


test('bootstraps a persistent server seed when no configured seed or active database seed exists', async () => {
  let inserted = false;
  const seed = await getOrCreateServerSeed(undefined, {
    query: async () => [],
    transaction: async (fn: any) => fn({ query: async () => { inserted = true; return { rowCount: 1, rows: [] }; } }),
  });

  assert.equal(inserted, true);
  assert.equal(typeof seed.seed, 'string');
  assert.equal(seed.seed.length, 64);
  assert.match(seed.seedHash, /^[a-f0-9]{64}$/);
});

test('reuses the configured seed when it matches an existing database commitment', async () => {
  const configuredSeed = 'a'.repeat(64);
  const { sha256 } = await import('./lib/provablyFair');
  const configuredHash = await sha256(configuredSeed);

  const seed = await getOrCreateServerSeed(configuredSeed, {
    query: async () => [{ seed: configuredSeed, seed_hash: configuredHash, status: 'active', active: 1 }],
    transaction: async () => { throw new Error('should not create a new seed'); },
  });

  assert.equal(seed.seed, configuredSeed);
  assert.equal(seed.seedHash, configuredHash);
});
