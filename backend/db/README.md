# PostgreSQL

PocketPull application data is stored in PostgreSQL. Configure the server with `DATABASE_URL`; never commit credentials. Blink remains the JWT authentication provider during this migration phase.

## Apply schema

Run:

`npm run db:migrate`

The migration runner applies every SQL file in `backend/db/migrations` in numeric order and records applied versions in `schema_migrations`.

## Move existing Blink data

From an environment with the existing Blink credentials:

`npm run db:export -- ./blink-export.json`

Then validate and import:

`npm run db:import -- ./blink-export.json --dry-run`

`npm run db:import -- ./blink-export.json`

Finally:

`npm run db:validate`

The importer is idempotent and does not delete or modify the Blink source data.

## Runtime behavior

Legacy backend route contracts that previously accessed `blink.db` are routed through the PostgreSQL compatibility data layer. This lets the migration preserve the existing application behavior while the storage engine changes to PostgreSQL. Blink realtime/auth services are not used as the application database.

## Rollback

Do not delete the Blink source database until the PostgreSQL deployment has been exercised and validated. Before cutover is accepted, rollback is simply redeploying the previous application revision.
