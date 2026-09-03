import { test, expect } from 'node:test';
import { readFileSync } from 'node:fs';

test('support admin chat keeps polling silent and subscribes to realtime', () => {
  const source = readFileSync(new URL('./SupportChatsTabFixed.tsx', import.meta.url), 'utf8');
  expect(source).toContain('setInterval(()=>void reconcileChats(false),15000)');
  expect(source).toContain('blink.realtime.subscribe(CHANNEL');
  expect(source).toContain('if(initial)setLoading(true)');
});
