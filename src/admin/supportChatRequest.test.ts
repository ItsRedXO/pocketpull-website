import assert from 'node:assert/strict';
import test from 'node:test';
import { isLatestRequest } from './supportChatRequest';

test('stale chat message requests are rejected when a newer request exists', () => {
  assert.equal(isLatestRequest(1, 2), false);
  assert.equal(isLatestRequest(2, 2), true);
});

test('a request remains current when no newer request has started', () => {
  assert.equal(isLatestRequest(7, 7), true);
});
