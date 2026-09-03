import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const distDir = new URL('../dist/', import.meta.url);

await mkdir(distDir, { recursive: true });
await writeFile(new URL('index.html', distDir), '<!doctype html><html><body>PocketPull Railway</body></html>');

const { default: app } = await import('./index');

test('serves the compiled frontend at the root path', async () => {
  const response = await app.request('/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /PocketPull Railway/);
});

test('serves the compiled frontend for SPA routes', async () => {
  const response = await app.request('/admin');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /PocketPull Railway/);
});

test('keeps API health route ahead of the frontend fallback', async () => {
  const response = await app.request('/health');
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.doesNotMatch(await response.text(), /PocketPull Railway/);
});

test.after(async () => {
  await rm(distDir, { recursive: true, force: true });
});
