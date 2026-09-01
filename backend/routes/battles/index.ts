import { Hono } from 'hono';
import lobbyRoutes from './lobby';
import executeRoutes from './execute';
import postgresExecuteRoutes from './postgresExecute';
import adminRoutes from './admin';

const app = new Hono();

// Existing production-compatible routes.
app.route('/', lobbyRoutes);
app.route('/', executeRoutes);
app.route('/admin', adminRoutes);

// Isolated PostgreSQL migration endpoint. This does not replace /execute yet.
app.route('/postgres', postgresExecuteRoutes);

export default app;
