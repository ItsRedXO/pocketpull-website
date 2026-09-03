import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canReturnCashout } from './lib/cashoutAdminPolicy';

describe('cashout admin return policy', () => {
  it('allows returning a pending request', () => {
    assert.equal(canReturnCashout('pending'), true);
  });

  it('blocks returning a partially fulfilled request', () => {
    assert.equal(canReturnCashout('partial'), false);
  });

  it('blocks returning shipped or completed requests', () => {
    assert.equal(canReturnCashout('shipped'), false);
    assert.equal(canReturnCashout('completed'), false);
  });
});
