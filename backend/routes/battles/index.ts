import { Hono } from 'hono';
import lobbyRoutes from './lobby';
import executeRoutes from './executePg';
import adminRoutes from './admin';

const app = new Hono();

app.route('/', lobbyRoutes);
app.route('/', executeRoutes);
app.route('/admin', adminRoutes);

export default app;
