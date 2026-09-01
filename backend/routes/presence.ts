import { Hono } from 'hono';
const app=new Hono();
app.get('/presence/count',c=>c.json({count:0}));
export default app;
