import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Packs admin tab uses only real packs_catalog columns', () => {
  const source = read('src/admin/PacksTab.tsx');
  assert.match(source, /packs_catalog has neither sort_order nor created_at/);
  assert.match(source, /packsCatalog\.list\(\{ orderBy: \{ name: 'asc' \} \}\)/);
  assert.doesNotMatch(source, /packsCatalog\.list\(\{[^}]*orderBy:\s*\{\s*sortOrder/s);
  assert.doesNotMatch(source, /packsCatalog\.list\(\{[^}]*orderBy:\s*\{\s*createdAt/s);
});

test('Users admin tab excludes AI users and blank placeholder rows from account counts', () => {
  const source = read('src/admin/UsersTab.tsx');
  assert.match(source, /const isBot = Number\(r\.isBot \|\| r\.is_bot\) > 0/);
  assert.match(source, /const hasAccountIdentity = Boolean\(r\.username \|\| r\.displayName \|\| r\.display_name \|\| r\.email\)/);
  assert.match(source, /return !isBot && hasAccountIdentity/);
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
