# PostgreSQL migration status

The `postgres-migration` branch now routes PocketPull application-data access through PostgreSQL. Blink JWT verification remains the authentication boundary, while the legacy Blink DB API is backed by a PostgreSQL compatibility layer so existing battle, payment, upgrader, exchanger, cashout, admin, inventory, and logging routes continue to use the same application contracts while the storage engine changes underneath them.

The branch also contains:

- PostgreSQL schema migrations and indexes
- PostgreSQL connection/transaction helpers
- Wallet ledger with row locking and idempotency
- PostgreSQL-backed pack opening and provably-fair persistence
- Mystery-pack finite-stock claims
- Inventory lock/favorite/sell/sell-all persistence
- Battle compatibility schema and persistence
- Import/export format and idempotent Blink-data importer
- Migration validation tooling
- Backend TypeScript coverage for the migration code

## Remaining external cutover work

1. Provision PostgreSQL and set `DATABASE_URL` in the deployment environment.
2. Run `npm run db:migrate`.
3. Export the existing Blink application data into the documented JSON format.
4. Run the importer with `--dry-run`, then import and run `npm run db:validate`.
5. Test the migrated branch against the new database and fix any environment/runtime-specific issues discovered during real execution.

No production database is contacted by these repository changes and no Blink data is deleted.
