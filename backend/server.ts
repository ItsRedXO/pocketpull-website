import { serve } from '@hono/node-server';
import app from './index.ts';

const port = Number(process.env.PORT || 8787);

serve({
  fetch: (request) => app.fetch(request, process.env as any),
  port,
}, (info) => {
  console.log(`[PocketPull API] listening on http://localhost:${info.port}`);
});
