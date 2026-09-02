# Blink → PostgreSQL import

The migration keeps Blink as the authentication provider but moves PocketPull application data into PostgreSQL.

## 1. Export Blink data

In an environment that has the existing Blink credentials:

`BLINK_PROJECT_ID=... BLINK_SECRET_KEY=... npm run db:export -- ./blink-export.json`

The exporter writes the application tables using the PostgreSQL table names and preserves IDs, timestamps, numeric values, nulls, and structured JSON fields. It does not modify or delete Blink data.

## 2. Prepare PostgreSQL

Set `DATABASE_URL` in the server environment and run:

`npm run db:migrate`

## 3. Dry-run the import

`npm run db:import -- ./blink-export.json --dry-run`

## 4. Import

`npm run db:import -- ./blink-export.json`

## 5. Validate

`npm run db:validate`

The importer is idempotent for primary/composite keys and never deletes source data.
