import { serve } from '@hono/node-server';
import app from './index';
import { startProvablyFairRotationScheduler } from './lib/provablyFairScheduler';

const port = Number(process.env.PORT || 8787);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`PocketPull PostgreSQL backend listening on ${info.address}:${info.port}`);
  startProvablyFairRotationScheduler();
});
