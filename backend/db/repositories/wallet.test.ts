import { describe, expect, it } from 'vitest';
import { calculateWalletBalances } from './wallet';

describe('calculateWalletBalances', () => {
  it('credits real balance without changing matched balance', () => {
    expect(calculateWalletBalances(10, 3, 5)).toEqual({ balanceAfter: 15, matchedAfter: 3 });
  });

  it('credits matched balance when explicitly requested', () => {
    expect(calculateWalletBalances(10, 3, 5, 5)).toEqual({ balanceAfter: 15, matchedAfter: 8 });
  });

  it('spends matched balance first on a debit', () => {
    expect(calculateWalletBalances(20, 7, -10, 7)).toEqual({ balanceAfter: 10, matchedAfter: 0 });
  });

  it('never changes matched balance on a zero-value transaction', () => {
    expect(calculateWalletBalances(20, 7, 0, 7)).toEqual({ balanceAfter: 20, matchedAfter: 7 });
  });
});
