import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportMessageScope } from './supportMessageScope';

test('authenticated support message reads are constrained by chat ownership', () => {
  const scope = buildSupportMessageScope('user-123');
  assert.deepEqual(scope.params, ['user-123']);
  assert.match(scope.clause, /chat_id IN \(SELECT id FROM support_chats WHERE user_id=\$1\)/);
});
