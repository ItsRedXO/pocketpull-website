# PostgreSQL

PocketPull application data is stored in PostgreSQL. Configure the server with `DATABASE_URL`; never commit credentials.

Apply `backend/db/migrations/001_initial_schema.sql` followed by `002_indexes_and_constraints.sql`. Import existing exported data with `npm run db:import -- ./blink-export.json`, then validate with `npm run db:validate`.

The migration branch does not contact production and does not delete Blink data. Rollback is performed by redeploying the previous application revision until PostgreSQL cutover has been validated.
