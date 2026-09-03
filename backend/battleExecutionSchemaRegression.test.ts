import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const executeSource = await readFile(
  new URL('./routes/battles/executePg.ts', import.meta.url),
  'utf8',
);

test('PostgreSQL battle execution does not update the removed is_spinning column', () => {
  assert.doesNotMatch(executeSource, /\bis_spinning\b/);
});

test('battle execution schema test covers the PostgreSQL route, not the legacy route', () => {
  assert.match(executeSource, /app\.post\('\/execute'/);
  assert.match(executeSource, /processWalletTransactionInClient/);
});
