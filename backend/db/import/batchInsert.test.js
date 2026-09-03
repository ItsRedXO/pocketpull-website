import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRowsByColumns, buildBatchInsert } from './batchInsert.js';

test('groups rows with identical column shapes', () => {
  const rows = [
    { columns: ['id','name'], values: ['a','A'] },
    { columns: ['id'], values: ['b'] },
    { columns: ['id','name'], values: ['c','C'] },
  ];
  const groups = groupRowsByColumns(rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].columns, ['id','name']);
  assert.equal(groups[0].rows.length, 2);
  assert.deepEqual(groups[1].columns, ['id']);
});

test('builds one multi-row insert with sequential placeholders', () => {
  const result = buildBatchInsert({
    table: 'users',
    columns: ['id','username'],
    rows: [['u1','red'],['u2','blue']],
    conflictTarget: 'id',
  });
  assert.equal(result.sql, 'INSERT INTO users (id,username) VALUES ($1,$2),($3,$4) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username');
  assert.deepEqual(result.values, ['u1','red','u2','blue']);
});

test('uses DO NOTHING when only conflict columns are present', () => {
  const result = buildBatchInsert({ table: 'users', columns: ['id'], rows: [['u1'],['u2']], conflictTarget: 'id' });
  assert.match(result.sql, /ON CONFLICT \(id\) DO NOTHING$/);
});
