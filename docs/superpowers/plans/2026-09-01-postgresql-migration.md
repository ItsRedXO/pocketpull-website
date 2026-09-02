# PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PocketPull application-data access through Blink DB with PostgreSQL while preserving current behavior, auth, payments, provably-fair logic, wallet economics, inventory, battles, upgrader, exchanger, cashouts, and admin flows.

**Architecture:** Keep Blink JWT verification as the authentication boundary. Introduce a PostgreSQL data-access layer using `DATABASE_URL`, then migrate domain operations behind repositories. Critical balance, inventory, pack-stock, mystery-vault, and battle mutations use PostgreSQL transactions and row-level locks/atomic updates.

**Tech Stack:** Vite + React + TypeScript frontend; Hono backend; PostgreSQL; SQL migrations; existing Blink auth; Stripe/Coinbase; existing provably-fair HMAC/SHA-256 implementation.

**Spec:** `docs/superpowers/specs/2026-09-01-postgresql-migration-design.md`

## Global Constraints
- PostgreSQL is the single source of truth for PocketPull application data.
- Blink remains only for authentication/JWT verification during this migration phase.
- PostgreSQL is configured through `DATABASE_URL`; no credentials are committed.
- Never interpolate user-controlled values into SQL; use parameterized queries.
- Wallet, inventory, finite pack stock, mystery-vault claims, and battle state transitions must be transactionally safe under concurrency.
- Existing IDs, timestamps, business rules, pack odds, provably-fair calculations, and audit values remain compatible.
- No production data is modified by repository code changes alone; no destructive cutover or Blink deletion is performed.
- Work stays on `postgres-migration`; `main` remains untouched.
- Final verification must show no application route/domain code still calls `blink.db` for application data.

---

### Task 1: PostgreSQL foundation and schema
**Files:** Create `backend/lib/postgres.ts`, `backend/lib/db.ts`, `backend/db/migrations/001_initial_schema.sql`, `backend/db/migrations/002_indexes_and_constraints.sql`; modify `package.json` and `package-lock.json`.

- [ ] Add a PostgreSQL driver compatible with the Hono deployment runtime.
- [ ] Implement `getDb(databaseUrl)`, parameterized `query<T>(sql, params)`, and `transaction(fn)`.
- [ ] Define all application tables discovered from current Blink DB usage: users/profile, packs/cards/odds, inventory, transactions/wallet, pack openings, PF seeds/nonces/odds versions, battles/participants/results/audits, upgrader settings/history, exchanger activity, cashouts, activity logs, outbound email logs, and related configuration/state.
- [ ] Preserve string IDs and legacy timestamps/flags; use `numeric` for money, `timestamptz` for timestamps, and `jsonb` for structured audit data.
- [ ] Add foreign keys, idempotency uniqueness constraints, and indexes for ownership/history/state/PF lookups.
- [ ] Add migration metadata and disposable-PostgreSQL schema tests.
- [ ] Commit `feat: add PostgreSQL foundation and schema`.

### Task 2: Data import and validation
**Files:** Create `backend/db/import/exportFormat.ts`, `backend/db/import/importBlinkExport.ts`, `backend/db/validateMigration.ts`, `backend/db/import/README.md`.

- [ ] Define an explicit JSON/JSONL export format preserving table names, IDs, timestamps, numeric/null/JSON values.
- [ ] Implement ordered, batched, idempotent imports using primary-key upserts.
- [ ] Implement dry-run validation.
- [ ] Validate row counts, foreign keys, duplicate IDs, wallet balances, inventory ownership, pack/card relationships, PF relationships, and battle relationships.
- [ ] Document external Blink export input; never invent live database credentials.
- [ ] Commit `feat: add PostgreSQL import and validation tooling`.

### Task 3: Users, transactions, and wallet
**Files:** Modify `backend/lib/auth.ts`, `backend/lib/wallet.ts`, `backend/lib/payments.ts`; create `backend/repositories/users.ts`, `backend/repositories/transactions.ts`, `backend/repositories/wallet.ts`.

- [ ] Keep Blink JWT verification unchanged and move deleted-account checks to PostgreSQL.
- [ ] Preserve first-deposit and referral rules.
- [ ] Make wallet mutations lock the user row, calculate from locked values, and update balance/matched balance atomically.
- [ ] Enforce `sourceId` idempotency at the database level.
- [ ] Add concurrent wallet tests proving no double spend/overdraw.
- [ ] Commit `feat: migrate users and wallet to PostgreSQL`.

### Task 4: Packs, inventory, and provably fair
**Files:** Modify `backend/routes/packOpening.ts`, `backend/routes/inventory.ts`, `backend/routes/provablyFair.ts`, `backend/lib/provablyFair.ts`; create `backend/repositories/packs.ts`, `backend/repositories/inventory.ts`, `backend/repositories/provablyFair.ts`.

- [ ] Replace pack/card/odds application-data access with PostgreSQL.
- [ ] Preserve PF seed, nonce, odds-version, client-seed, roll-value, hash, and audit semantics exactly.
- [ ] Make pack opening a single transaction covering balance validation, finite stock/vault claim, inventory creation, opening audit, and wallet settlement.
- [ ] Prevent concurrent mystery-vault double claims.
- [ ] Migrate inventory lock/favorite/sell/sell-all with ownership checks and transactional consistency.
- [ ] Add concurrent opening/sell/claim tests.
- [ ] Commit `feat: migrate packs inventory and PF to PostgreSQL`.

### Task 5: Battles
**Files:** Modify `backend/routes/battles/lobby.ts`, `backend/routes/battles/execute.ts`, `backend/routes/battles/admin.ts`, `backend/routes/battles/utils.ts`; create `backend/repositories/battles.ts`.

- [ ] Move lobby, participant, result, and audit persistence to PostgreSQL.
- [ ] Preserve Standard, Underdog, Shared, bot reward routing, and PF behavior.
- [ ] Lock battle rows for join/start/execute transitions and reject stale transitions.
- [ ] Make execution, wallet settlement, inventory assignment, and audit creation atomic.
- [ ] Add concurrent join/execute tests preventing duplicate settlement.
- [ ] Commit `feat: migrate battles to PostgreSQL`.

### Task 6: Upgrader, exchanger, cashout, logs, and email logs
**Files:** Modify `backend/routes/upgrader.ts`, `backend/routes/upgraderSettings.ts`, `backend/routes/exchanger.ts`, `backend/routes/cashout.ts`, `backend/routes/cashoutAdmin.ts`, `backend/routes/logs.ts`, `backend/routes/sendTestEmails.ts`, `backend/lib/emailLogging.ts`; create repositories for upgrader, exchanger, cashouts, and logs.

- [ ] Replace all application-data Blink DB access in these flows.
- [ ] Preserve upgrader PF/settings semantics.
- [ ] Make exchanger inventory/balance transfers atomic.
- [ ] Make cashout transitions and deductions idempotent/transactional.
- [ ] Preserve admin authorization and audit/email records.
- [ ] Test repeated admin/financial operations.
- [ ] Commit `feat: migrate remaining domain flows to PostgreSQL`.

### Task 7: Payments and application entrypoint
**Files:** Modify `backend/routes/stripe.ts`, `backend/routes/coinbase.ts`, `backend/index.ts`.

- [ ] Move payment-state/user/transaction persistence to PostgreSQL.
- [ ] Preserve Stripe/Coinbase webhook idempotency so retries cannot double-credit deposits.
- [ ] Keep health/statistics behavior intact while sourcing battle counts from PostgreSQL.
- [ ] Remove application-data Blink client construction.
- [ ] Commit `feat: finish PostgreSQL backend cutover`.

### Task 8: Remove Blink DB dependency and verify
**Files:** Modify `backend/lib/auth.ts`, `backend/index.ts`, `package.json`, `README.md`; create `backend/db/README.md`.

- [ ] Repository-wide search for `blink.db` and equivalent application-data SDK calls must return none in route/domain code.
- [ ] Remove unused Blink DB imports while retaining auth requirements.
- [ ] Document `DATABASE_URL`, migrations, import validation, and rollback.
- [ ] Run TypeScript, lint, disposable-PostgreSQL integration tests, migration validation, and critical financial/inventory invariants.
- [ ] Commit `chore: remove Blink database dependency`.

### Task 9: Whole-branch review and cutover readiness
- [ ] Review the complete branch for atomicity, idempotency, authorization, PF determinism, inventory ownership, finite-stock double claims, battle state transitions, and webhook retries.
- [ ] Confirm `main` and production data were untouched.
- [ ] Fix Critical/Important findings and re-run verification.
- [ ] Open a draft PR from `postgres-migration` to `main`; do not merge or deploy.
