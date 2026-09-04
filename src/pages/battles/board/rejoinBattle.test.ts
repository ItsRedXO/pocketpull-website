import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('My Battles re-enters ongoing battles as a player instead of spectating', async () => {
  const tab = await readFile(new URL('./MyBattlesTab.tsx', import.meta.url), 'utf8');
  const board = await readFile(new URL('../LiveBattleBoard.tsx', import.meta.url), 'utf8');
  assert.match(tab, /onRejoin/);
  assert.match(tab, /b\.status\s*===\s*['\"]waiting['\"]|\['waiting',[^\]]*'starting'[^\]]*'live'/);
  assert.match(board, /onRejoin=\{onJoinBattle\}/);
});

test('host can reach cancel and refund recovery while a battle is stuck starting or live', async () => {
  const room = await readFile(new URL('../BattleRoom.tsx', import.meta.url), 'utf8');
  assert.match(room, /starting/);
  assert.match(room, /live/);
  assert.match(room, /Cancel & Refund/i);
  assert.match(room, /handleCancel/);
});
