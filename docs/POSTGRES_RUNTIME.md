# PostgreSQL Backend Runtime

The migration branch now has an explicit Hono/Node API server at `backend/server.ts`.

## Required environment

- `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`
- `BLINK_PROJECT_ID` and `BLINK_SECRET_KEY` for the temporary external JWT identity bridge
- `BLINK_SERVER_SEED` for provably-fair operations
- Stripe/Coinbase provider secrets for payment routes

## Local development

Run the backend on port `8787` and the Vite frontend on port `3000`.
Vite proxies `/api/*` to the backend and strips the `/api` prefix.

Set `VITE_API_BASE_URL` when the backend is hosted separately. If it is not set, the frontend uses `/api`.

## Architecture rule

Blink is not an application database on this branch. Its remaining responsibilities are external identity/token verification, realtime transport, and external notification delivery. Application state is stored and mutated in PostgreSQL.
