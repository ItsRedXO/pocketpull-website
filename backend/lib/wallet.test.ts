import { describe, expect, test } from 'node:test';
import { calculateWalletBalances } from './wallet';

describe('calculateWalletBalances', () => {
  test('spends matched balance first without double-deducting real balance', () => {
    const result = calculateWalletBalances(100, 40, -30, true);

    expect(result.balanceAfter).toBe(100);
    expect(result.matchedAfter).toBe(10);
  });

  test('uses real balance for the portion not covered by matched balance', () => {
    const result = calculateWalletBalances(20, 10, -30, true);

    expect(result.balanceAfter).toBe(0);
    expect(result.matchedAfter).toBe(0);
  });

  test('credits real and matched balances independently', () => {
    const result = calculateWalletBalances(20, 10, 25, true, 25);

    expect(result.balanceAfter).toBe(45);
    expect(result.matchedAfter).toBe(35);
  });
});
