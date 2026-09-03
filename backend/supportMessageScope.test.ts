import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportMessageScope } from './supportMessageScope';

test('support message list is scoped to chats owned by the authenticated user', () => {
  const scope = buildSupportMessageScope('user-123');
  assert.deepEqual(scope.params, ['user-123']);
  assert.match(scope.clause, /chat_id IN \(SELECT id FROM support_chats WHERE user_id=\$1\)/);
});

test('support message scope never falls back to an unfiltered list', () => {
  const scope = buildSupportMessageScope('user-123');
  assert.notEqual(scope.clause.trim(), '');
  assert.match(scope.clause, /support_chats/);
});
