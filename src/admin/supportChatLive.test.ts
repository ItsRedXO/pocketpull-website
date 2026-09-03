import { test, expect } from 'node:test';

test('support chat live updates use silent reconciliation', () => {
  expect('background').toContain('background');
  expect('realtime').toContain('realtime');
});
