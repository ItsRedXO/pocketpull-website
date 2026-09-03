import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE_REFRESH_INTERVAL_MS } from './balanceRefresh';

test('wallet balance refreshes frequently enough for admin credit changes', () => {
  assert.equal(BALANCE_REFRESH_INTERVAL_MS, 3000);
});
