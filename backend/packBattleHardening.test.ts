import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const executeSource = await readFile(new URL('./routes/battles/executePg.ts', import.meta.url), 'utf8');
const recoverySource = await readFile(new URL('./routes/battles/recovery.ts', import.meta.url), 'utf8');

test('2v2 settlement awards pulled cards only and does not mint wallet cash rewards', () => {
  assert.doesNotMatch(executeSource, /battle_team_reward/);
  assert.doesNotMatch(executeSource, /teamPot\s*=|amount:\s*share/);
  assert.match(executeSource, /distributeCardsShared/);
});

test('battle cancellation refunds every human participant exactly once', () => {
  assert.doesNotMatch(recoverySource, /humans\.length\s*>\s*1/);
  assert.match(recoverySource, /for\s*\(const\s+human\s+of\s+humans\)/);
  assert.match(recoverySource, /battle_entry_refund/);
  assert.match(recoverySource, /refundSource\s*=\s*`\$\{battleId\}:refund:\$\{human\.user_id\}`/);
});

test('settled battles remain non-refundable', () => {
  assert.match(recoverySource, /inventory_count/);
  assert.match(recoverySource, /audit_count/);
  assert.match(recoverySource, /already settled and cannot be refunded/);
});
