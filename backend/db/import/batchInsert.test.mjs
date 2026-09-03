import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBatchInsert } from './batchInsert.js';

test('buildBatchInsert supports conflict-free import batches', () => {
  const { sql, values } = buildBatchInsert({
    table: 'wallet_transactions',
    columns: ['id', 'user_id', 'source_id'],
    rows: [['a', 'u1', 's1']],
    conflictTarget: '',
  });

  assert.match(sql, /ON CONFLICT DO NOTHING$/);
  assert.deepEqual(values, ['a', 'u1', 's1']);
});
