import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Packs admin tab does not order packs by a missing sortOrder column', () => {
  const source = read('src/admin/PacksTab.tsx');
  assert.match(source, /packs_catalog has no sort_order column/);
  assert.match(source, /packsCatalog\.list\(\{ orderBy: \{ createdAt: 'asc' \} \}\)/);
  assert.doesNotMatch(source, /packsCatalog\.list\(\{[^}]*orderBy:\s*\{\s*sortOrder/s);
});

test('Email admin tab orders by createdAt and reads legacy fields from row data', () => {
  const source = read('src/admin/EmailsTab.tsx');
  assert.match(source, /orderBy:\s*\{\s*createdAt:\s*'desc'\s*\}/);
  assert.match(source, /sentAt:\s*String\(r\?\.sentAt \|\| data\.sentAt \|\| r\?\.createdAt/);
});

test('Stats admin tab keeps successful metrics when one metric query fails', () => {
  const source = read('src/admin/StatsTab.tsx');
  assert.match(source, /Promise\.allSettled\(/);
  assert.match(source, /totalUsersResult/);
  assert.match(source, /totalPacksResult/);
});
