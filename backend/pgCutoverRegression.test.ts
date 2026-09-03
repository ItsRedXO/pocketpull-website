import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const upgraderSource = await readFile(new URL('./routes/upgrader.ts', import.meta.url), 'utf8');
const battleExecuteSource = await readFile(new URL('./routes/battles/execute.ts', import.meta.url), 'utf8');

test('upgrader resolves its PostgreSQL provably-fair seed through the shared bootstrap helper', () => {
  assert.match(upgraderSource, /getOrCreateServerSeed/);
  assert.doesNotMatch(upgraderSource, /Provably fair system not initialized\. Please contact support\./);
});

test('battle execution resolves its PostgreSQL provably-fair seed through the shared bootstrap helper', () => {
  assert.match(battleExecuteSource, /getOrCreateServerSeed/);
  assert.doesNotMatch(battleExecuteSource, /Provably fair system not initialized\. Please contact support\./);
});
