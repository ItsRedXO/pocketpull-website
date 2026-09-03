import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminSecretCandidate } from './lib/adminAuthorization';

describe('admin authorization', () => {
  it('rejects the placeholder admin secret', () => {
    assert.equal(isAdminSecretCandidate('true'), false);
    assert.equal(isAdminSecretCandidate(''), false);
  });

  it('accepts a non-empty credential candidate', () => {
    assert.equal(isAdminSecretCandidate('real-admin-secret'), true);
  });
});
