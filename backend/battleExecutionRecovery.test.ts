import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/battles/room/useBattleLogic.ts', import.meta.url), 'utf8');

test('battle room retries execution when the host reconnects to a live battle with no results', () => {
  assert.match(source, /battle\.status === 'live'/);
  assert.match(source, /launchBattle\(battleRef\.current\)/);
});
