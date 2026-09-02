# PostgreSQL migration status

The `postgres-migration` branch routes PocketPull application-data access through PostgreSQL. Blink JWT verification remains the authentication boundary, while the legacy Blink DB API is backed by a PostgreSQL compatibility layer so existing battle, payment, upgrader, exchanger, cashout, admin, inventory, and logging contracts can remain stable while the storage engine changes underneath them.

The branch contains:

- PostgreSQL schema migrations, indexes, compatibility fields, and migration state tracking
- PostgreSQL connection and transaction helpers
- Wallet ledger with row locking and idempotency
- PostgreSQL-backed pack opening and provably-fair persistence
- Inventory lock/favorite/sell/sell-all persistence
- Battle compatibility schema, execution claiming, audits, and persistence
- Transactional payment/deposit, upgrader, exchanger, inventory-sale, and pack-opening flows
- Cashout persistence plus database-enforced partial-return tracking that prevents duplicate returns and blocks shipping a returned card after that inventory copy is sold
- Import/export format and idempotent Blink-data importer
- Migration validation tooling
- A Node/Hono backend entry point and production backend Dockerfile
- Frontend `VITE_BACKEND_URL` cutover support, including a build-time compatibility rewrite for legacy backend URL literals
- CI that boots PostgreSQL 16, applies every migration, validates the schema, exercises cashout return safety, typechecks the backend, builds the frontend against a PostgreSQL backend URL, verifies the legacy backend URL is absent from that production bundle, smoke-tests `/health`, and builds the backend container

## Remaining external cutover work

1. Provision the production PostgreSQL database and backend host.
2. Set backend environment variables, especially `DATABASE_URL`, plus the existing Blink JWT/payment/provider secrets.
3. Run `npm run db:migrate` against production PostgreSQL.
4. Export the existing Blink application data into the documented JSON format.
5. Run the importer with `--dry-run`, then import and run `npm run db:validate`.
6. Deploy the Node backend and point the frontend `VITE_BACKEND_URL` at it.
7. Perform a real-site smoke test of login, deposits, pack openings, battles, upgrader, exchanger, inventory sale, cashout, support, and admin flows before switching production traffic permanently.

No production database is contacted by these repository changes, no Blink application data is deleted, and `main` is not modified by the migration branch itself.
