# PocketPull PostgreSQL Migration Design

## Goal
Replace PocketPull's Blink database as the application data store with PostgreSQL while preserving the existing frontend, Blink JWT authentication, payment integrations, provably-fair behavior, wallet semantics, battles, inventory, admin flows, and current business rules.

## Current State
The backend is a Hono TypeScript service. Its route modules and shared libraries obtain a Blink server client and perform application reads/writes through `blink.db.*`. Blink auth is also used to verify the Authorization JWT. The frontend is a Vite React application and should not be rewritten as part of this migration.

## Target Architecture
- PostgreSQL becomes the single source of truth for PocketPull application data.
- Blink remains only for authentication/JWT verification during this migration phase; application tables are no longer read from or written to `blink.db`.
- A dedicated PostgreSQL module owns connection pooling, query execution, transactions, and common helpers.
- Domain operations that move money, matched balance, inventory, pack stock, or battle state execute inside PostgreSQL transactions and use row-level locking/atomic updates where concurrency matters.
- Route handlers call domain/data functions rather than embedding connection-management logic.
- Database schema is versioned with SQL migrations committed to the repository.
- PostgreSQL is configured through `DATABASE_URL`; no database credentials are committed.

## Data Model Scope
The migration covers every application entity currently represented by Blink DB usage, including users/profile state, packs and pack cards/odds, inventory, transactions/wallet state, pack openings and audit records, provably-fair seeds/nonces/odds versions, battles and battle participants/results/audits, upgrader settings/history, exchanger activity, cashout requests, admin/activity logs, outbound email logs, and related configuration/state discovered during the code audit.

Existing column semantics and IDs should be preserved wherever practical so the frontend and historical records remain compatible. PostgreSQL types should use `numeric` for monetary values, `timestamptz` for timestamps, `boolean`/integer semantics consistently with the application, and `jsonb` for structured audit/detail payloads.

## Security and Concurrency
- Never interpolate user-controlled values into SQL.
- Use parameterized queries throughout.
- Wallet mutations must be atomic and must prevent lost updates/double spending under concurrent requests.
- Inventory ownership/locking and transfers must be transactionally consistent.
- Pack stock and mystery-vault card claims must be transactionally consistent so the same finite card cannot be awarded twice.
- Battle creation/join/execute transitions must preserve the existing state-machine rules under concurrent requests.
- Existing provably-fair calculations and stored audit values must remain deterministic; database migration must not replace PF logic with database randomness.
- Existing authorization/admin checks remain enforced at the route boundary.

## Migration Strategy
1. Add PostgreSQL schema and migration tooling without changing production behavior on `main`.
2. Add a PostgreSQL repository/data-access layer and migrate backend modules domain-by-domain.
3. Preserve Blink JWT verification but replace all application `blink.db` reads/writes.
4. Add a data migration/import utility that can load an exported Blink dataset into PostgreSQL while preserving IDs and timestamps. The repository cannot assume access to PocketPull's live Blink database credentials, so the importer must accept an explicit export/input rather than inventing access.
5. Add verification queries/checks for row counts, foreign-key integrity, wallet balances, inventory ownership, transaction totals, pack/card relationships, PF audit relationships, and battle records.
6. Remove the application dependency on Blink DB access after all backend routes are migrated. Blink SDK may remain only if required for auth verification.

## Rollout / Safety
- All work stays on `postgres-migration`; `main` is untouched.
- No production data is modified by code changes alone.
- Migration scripts must support a dry-run/validation phase before destructive or cutover operations.
- The final cutover should occur only after a PostgreSQL database has been populated and validation passes.
- Rollback means switching the deployed application back to the previous commit/database path; PostgreSQL migration scripts must not delete the original Blink data.

## Testing
- TypeScript compilation and linting must pass.
- Unit tests cover PostgreSQL helpers and critical wallet/inventory transaction behavior.
- Integration tests exercise representative route/domain flows against a disposable PostgreSQL database.
- Migration validation checks schema constraints and referential integrity.
- Security-sensitive operations are tested under concurrent execution where practical.
- A final repository search must show no application route/domain code still calling `blink.db` for application data.

## Out of Scope
- Replacing Blink authentication in this migration.
- Redesigning the frontend.
- Changing PocketPull business rules, pack odds, PF algorithms, wallet economics, battle rules, or admin UX unless required to make the PostgreSQL implementation correct.
- Deploying to production or deleting the existing Blink database.
