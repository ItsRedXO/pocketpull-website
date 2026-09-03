import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { closeDb } from './lib/postgres';

const distDir = new URL('../dist/', import.meta.url);

await mkdir(distDir, { recursive: true });
await writeFile(new URL('index.html', distDir), '<!doctype html><html><body>PocketPull Railway</body></html>');
await writeFile(new URL('pocketpull-logo.svg', distDir), '<svg xmlns="http://www.w3.org/2000/svg"><text>PocketPull</text></svg>');

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

test('serves the Railway-safe PocketPull logo for legacy PNG requests', async () => {
  const response = await app.request('/pocketpull-logo.png');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /image\/svg\+xml/);
  assert.match(await response.text(), /PocketPull/);
});

test.after(async () => {
  await closeDb();
  await rm(distDir, { recursive: true, force: true });
});
