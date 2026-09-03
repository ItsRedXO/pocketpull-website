import assert from 'node:assert/strict';
import test from 'node:test';

import { createPostgresDb } from '../src/lib/postgresDb';

test('PostgreSQL browser adapter sends the dedicated admin secret', async () => {
  const calls: RequestInit[] = [];
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {
    localStorage: { getItem: (key: string) => key === 'pocketpull_admin_pass' ? 'admin-secret-for-test' : null },
  };
  globalThis.fetch = async (_input, init) => {
    calls.push(init || {});
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const db = createPostgresDb(async () => null);
    await db.users.list({ limit: 1 });
    const headers = new Headers(calls[0].headers as HeadersInit);
    assert.equal(headers.get('X-Admin-Secret'), 'admin-secret-for-test');
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }
});

test('PostgreSQL browser adapter exposes count()', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: 26 }), { status: 200 });
  try {
    const db = createPostgresDb(async () => null);
    assert.equal(await db.packsCatalog.count({}), 26);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PostgreSQL browser adapter exposes upsert()', async () => {
  let requestBody: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: { id: 'test-id' } }), { status: 200 });
  };
  try {
    const db = createPostgresDb(async () => null);
    const result = await db.upgraderMultiplierSettings.upsert({ id: 'test-id', maxChance: 50 });
    assert.deepEqual(result, { id: 'test-id' });
    assert.equal(requestBody.operation, 'upsert');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
