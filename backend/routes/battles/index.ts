import { Hono } from 'hono';
import recoveryRoutes from './recovery';
import lobbyRoutes from './lobby';
import executeRoutes from './executePg';
import adminRoutes from './admin';

const app = new Hono();

// Recovery routes must be registered first so cancellation uses the atomic,
// idempotent PostgreSQL implementation rather than the legacy handler.
app.route('/', recoveryRoutes);
app.route('/', lobbyRoutes);
app.route('/', executeRoutes);
app.route('/admin', adminRoutes);

export default app;
