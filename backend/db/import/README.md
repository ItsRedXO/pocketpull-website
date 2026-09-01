# Blink → PostgreSQL import

Export PocketPull application tables from the existing Blink database into one JSON object keyed by the PostgreSQL table names. Preserve string IDs, timestamps, numeric amounts, nullable values, and structured fields.

Set `DATABASE_URL` in the server environment. Validate an export without modifying PostgreSQL with:

`npm run db:import -- ./blink-export.json --dry-run`

Import with:

`npm run db:import -- ./blink-export.json`

After import, run `npm run db:validate` to check row counts and critical orphan/idempotency invariants. The importer never contacts Blink and never deletes source data.
