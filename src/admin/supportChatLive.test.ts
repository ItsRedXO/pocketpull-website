import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('support admin chat keeps polling silent and subscribes to realtime', () => {
  const source = readFileSync(new URL('./SupportChatsTabFixed.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('setInterval(()=>void reconcileChats(false),15000)'));
  assert.ok(source.includes('blink.realtime.subscribe(CHANNEL'));
  assert.ok(source.includes('if(initial)setLoading(true)'));
});
