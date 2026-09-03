import test from 'node:test';
import assert from 'node:assert/strict';
import { isExactTie } from './routes/battles/utils';

test('standard battle tie detection treats a shared top score as a tie', () => {
  const results = [
    { totalValue: 100 },
    { totalValue: 100 },
    { totalValue: 50 },
  ];

  assert.equal(isExactTie(results, 'standard'), true);
});

test('underdog battle tie detection treats a shared lowest score as a tie', () => {
  const results = [
    { totalValue: 10 },
    { totalValue: 10 },
    { totalValue: 40 },
  ];

  assert.equal(isExactTie(results, 'underdog'), true);
});
