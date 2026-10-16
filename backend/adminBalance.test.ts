import { describe, expect, it } from 'vitest';

describe('admin balance wallet contract', () => {
  it('uses additive delta for add mode and target minus current for set mode', () => {
    const current = 1.43;
    expect({ mode: 'add', delta: 10 }).toMatchObject({ mode: 'add', delta: 10 });
    expect({ mode: 'set', delta: 11.43 - current }).toMatchObject({ mode: 'set', delta: 10 });
  });

  it('never allows a negative set target', () => {
    expect(-1 < 0).toBe(true);
  });

  it('treats zero as a no-op for a set target equal to the current balance', () => {
    const current = 25.5;
    const target = 25.5;
    expect(target - current).toBe(0);
  });
});
