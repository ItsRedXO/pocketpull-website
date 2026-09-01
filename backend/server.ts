import { serve } from '@hono/node-server';
import app from './index';

const runtime = (globalThis as any).process;
const port = Number(runtime?.env?.PORT || 8787);
const env = runtime?.env || {};

serve({
  fetch: (request) => app.fetch(request, env),
  port,
}, (info) => {
  console.log(`[backend] PostgreSQL API listening on http://localhost:${info.port}`);
});
