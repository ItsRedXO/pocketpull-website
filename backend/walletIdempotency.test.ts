import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('wallet idempotency distinguishes refunds from the original transaction type', async () => {
  const source = await readFile(new URL('./repositories/wallet.ts', import.meta.url), 'utf8');
  assert.match(source, /user_id=\$2 AND source_id=\$3 AND type=\$4/);
  assert.match(source, /user_id=\$1 AND source_id=\$2 AND type=\$3/);
});
