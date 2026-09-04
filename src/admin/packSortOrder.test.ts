import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin pack manager requests packs in configured sort order', async () => {
  const source = await readFile(new URL('./PacksTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /packsCatalog\.list\(\{\s*orderBy:\s*\{\s*sortOrder:\s*['\"]asc['\"]\s*\}\s*\}\)/);
  assert.doesNotMatch(source, /packsCatalog\.list\(\{\s*orderBy:\s*\{\s*name:\s*['\"]asc['\"]\s*\}\s*\}\)/);
});
