import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('battle client does not mark a battle finished after local animation', async () => {
  const source = await readFile(new URL('./useBattleExecution.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /status:\s*['"]finished['"]/);
  assert.match(source, /Battle status and settlement timestamps are backend-authoritative/);
});

test('non-host execution guard does not leave launchInFlight locked', async () => {
  const source = await readFile(new URL('./useBattleExecution.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!isHost \|\| watchOnly\) return;[\s\S]*launchInFlight\.current = true/);
});
