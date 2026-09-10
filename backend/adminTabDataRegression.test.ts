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

// This used to check client-side Promise.allSettled resilience in the (now
// deleted, dead) src/admin/StatsTab.tsx. The live tab, StatsTabFixed.tsx,
// fetches everything from GET /admin/stats instead, so the resilience now
// lives server-side in adminStats.ts -- check it there.
test('Admin stats endpoint keeps successful metrics when one metric query fails', () => {
  const source = read('backend/routes/adminStats.ts');
  assert.match(source, /Promise\.allSettled\(/);
  assert.doesNotMatch(source, /await Promise\.all\(/);
  assert.match(source, /function valueOr/);
});
