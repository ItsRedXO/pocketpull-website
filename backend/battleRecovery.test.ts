import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('battle recovery refunds use a distinct idempotency source and one transaction', async () => {
  const source = await readFile(new URL('./routes/battles/recovery.ts', import.meta.url), 'utf8');
  assert.match(source, /transaction\(async \(client\)/);
  assert.match(source, /const refundSource = `\$\{battleId\}:refund`/);
  assert.match(source, /battle_entry_refund/);
  assert.match(source, /inventory_count/);
  assert.match(source, /audit_count/);
});
