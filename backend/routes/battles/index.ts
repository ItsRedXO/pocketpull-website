import { Hono } from 'hono';
import lobbyRoutes from './lobby';
import postgresExecuteRoutes from './postgresExecute';
import adminRoutes from './admin';

const app = new Hono();
app.route('/', lobbyRoutes);
app.route('/', postgresExecuteRoutes);
app.route('/admin', adminRoutes);

export default app;
