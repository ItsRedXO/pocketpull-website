import { Hono } from 'hono';
import lobbyRoutes from './lobby';
import executeRoutes from './execute';
import adminRoutes from './admin';
import { getBlinkServer } from '../../lib/auth';

const app = new Hono();

// Mount routes under /
app.route('/', lobbyRoutes);
app.route('/', executeRoutes);
app.route('/admin', adminRoutes);

export default app;
