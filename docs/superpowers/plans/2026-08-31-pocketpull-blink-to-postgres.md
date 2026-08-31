# PocketPull Blink-to-PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PocketPull's Blink authentication/database/backend/realtime dependencies with an independently hosted Hono + PostgreSQL production stack while preserving existing accounts, balances, inventory, financial history, and provably-fair history.

**Architecture:** Keep the existing React/Vite frontend and Hono business routes where practical. Introduce a PostgreSQL data-access layer and migration tooling, replace Blink authentication with a server-owned authentication flow that preserves compatible password hashes or performs controlled password resets when hashes cannot be imported, and replace Blink realtime with a non-Blink mechanism. Keep Blink production untouched until the replacement passes the full test and reconciliation suite.

**Tech Stack:** TypeScript, React, Vite, Hono, PostgreSQL, Stripe, Coinbase, GitHub, Vitest or the repository's established test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-pocketpull-blink-to-postgres-design.md`

## Global Constraints

- Preserve existing user IDs and email addresses.
- Never migrate plaintext passwords or permanent session tokens.
- Never commit secrets, server seeds, database credentials, or payment credentials.
- Keep financial and provably-fair audit history immutable after import.
- Wallet mutations must be atomic PostgreSQL transactions.
- Payment webhooks must be idempotent.
- Historical provably-fair verification must reproduce existing results.
- Do not remove Blink dependencies from production paths until replacement tests pass.
- Do not modify `main` as part of migration implementation; work on `migration/postgres-foundation`.
- Every migration task must have an isolated test cycle before commit.

---

### Task 1: Validate the authoritative export and inventory the schema

**Files:**
- Create: `scripts/migration/inspect-blink-export.ts`
- Create: `docs/migration/blink-export-inventory.md`
- Test: `scripts/migration/inspect-blink-export.test.ts`

**Interfaces:**
- Consumes: directory of Blink-exported CSV files.
- Produces: deterministic table inventory containing filename, columns, inferred type, row count, nullability observations, candidate primary keys, and candidate foreign keys.

- [ ] **Step 1: Write the failing tests** for CSV discovery, header parsing, row counting, duplicate-ID detection, and consistent type inference.
- [ ] **Step 2: Run the migration inspection tests** and verify they fail because the inspector does not exist.
- [ ] **Step 3: Implement the inspector** using a streaming CSV parser so large tables are not loaded entirely into memory.
- [ ] **Step 4: Run the tests** and verify the generated inventory is deterministic.
- [ ] **Step 5: Run the inspector against the supplied export** and compare its table list with the application references.
- [ ] **Step 6: Record any tables present in the export but unused by the current code** so they are not silently discarded.
- [ ] **Step 7: Commit** with `git add scripts/migration docs/migration && git commit -m "chore: inventory Blink database export"`.

---

### Task 2: Define the PostgreSQL schema and compatibility layer

**Files:**
- Create: `backend/db/schema.sql`
- Create: `backend/db/client.ts`
- Create: `backend/db/types.ts`
- Create: `backend/db/repositories/users.ts`
- Create: `backend/db/repositories/wallet.ts`
- Create: `backend/db/repositories/packs.ts`
- Create: `backend/db/repositories/inventory.ts`
- Create: `backend/db/repositories/battles.ts`
- Create: `backend/db/repositories/provablyFair.ts`
- Create: `backend/db/repositories/cashouts.ts`
- Create: `backend/db/repositories/support.ts`
- Test: `backend/db/repositories/*.test.ts`

**Interfaces:**
- Consumes: authoritative export inventory from Task 1.
- Produces: typed PostgreSQL repositories with stable interfaces for users, wallet, packs, inventory, battles, PF, cashouts, and support.

- [ ] **Step 1: Add failing repository tests** for user lookup, pack/card lookup, inventory ownership, and PF record retrieval.
- [ ] **Step 2: Add failing schema tests** that require primary keys, foreign keys, unique constraints, and required indexes for the exported structures.
- [ ] **Step 3: Define PostgreSQL tables** using the real exported columns and preserve source IDs.
- [ ] **Step 4: Add indexes** for user ID, email, inventory owner, pack ID, battle status, transaction user/source ID, PF nonce/user, and audit lookup paths.
- [ ] **Step 5: Implement typed repository functions** and keep SQL out of route handlers.
- [ ] **Step 6: Run repository tests** against an isolated PostgreSQL test database and verify they pass.
- [ ] **Step 7: Commit** with `git add backend/db && git commit -m "feat: add PostgreSQL data layer"`.

---

### Task 3: Build a safe CSV-to-PostgreSQL migration importer

**Files:**
- Create: `scripts/migration/import-blink-csv.ts`
- Create: `scripts/migration/validate-import.ts`
- Create: `scripts/migration/reconciliation.ts`
- Test: `scripts/migration/import-blink-csv.test.ts`
- Test: `scripts/migration/reconciliation.test.ts`

**Interfaces:**
- Consumes: Task 1 inventory and Task 2 PostgreSQL schema.
- Produces: idempotent imports plus reconciliation reports for row counts, IDs, balances, inventory totals, transactions, and PF records.

- [ ] **Step 1: Write failing tests** for quoted CSV fields, numeric precision, timestamps, null values, duplicate IDs, foreign-key ordering, and rerunning an import without duplication.
- [ ] **Step 2: Implement staging/import ordering** so parent rows load before dependent rows while preserving source IDs.
- [ ] **Step 3: Implement conflict handling** that rejects conflicting duplicate IDs rather than silently overwriting data.
- [ ] **Step 4: Implement reconciliation** comparing source/export and target counts, IDs, wallet totals, inventory counts/values, transaction sums, and PF record counts.
- [ ] **Step 5: Run the importer against a disposable PostgreSQL database** and fix every reconciliation mismatch before proceeding.
- [ ] **Step 6: Commit** with `git add scripts/migration && git commit -m "feat: add Blink data migration tooling"`.

---

### Task 4: Replace the wallet implementation with atomic PostgreSQL transactions

**Files:**
- Modify: `backend/lib/wallet.ts`
- Modify: economy/payment routes that call `processWalletTransaction`
- Create: `backend/db/repositories/wallet.ts` transaction helpers if not already created in Task 2
- Test: `backend/lib/wallet.test.ts`

**Interfaces:**
- Consumes: `processWalletTransaction(blink, txn)` behavior and existing transaction types.
- Produces: `processWalletTransaction(db, txn)` with atomic row locking, idempotency, balance validation, matched-balance handling, and immutable ledger insertion.

- [ ] **Step 1: Write failing concurrency tests** for two simultaneous debits, duplicate source IDs, matched-balance spending, credits, and insufficient funds.
- [ ] **Step 2: Run tests** and verify the current implementation fails the atomicity requirements.
- [ ] **Step 3: Implement a PostgreSQL transaction** that locks the user row, computes the new balances, inserts the ledger row, and commits atomically.
- [ ] **Step 4: Add unique constraints** for the wallet ledger idempotency key/source combination required by each transaction type.
- [ ] **Step 5: Run concurrency tests** with parallel transactions and verify no lost updates or double credits occur.
- [ ] **Step 6: Commit** with `git add backend/lib/wallet.ts backend/db && git commit -m "feat: make wallet transactions atomic"`.

---

### Task 5: Replace authentication while preserving existing accounts

**Files:**
- Modify: `backend/lib/auth.ts`
- Create: `backend/auth/password.ts`
- Create: `backend/auth/session.ts`
- Create: `backend/routes/auth.ts`
- Modify: frontend authentication client/hooks that currently use Blink auth
- Test: `backend/auth/*.test.ts`

**Interfaces:**
- Consumes: imported users and any password-hash metadata available from the authoritative export.
- Produces: login, logout, session verification, password reset, and account migration behavior using stable PocketPull user IDs.

- [ ] **Step 1: Inspect the exported user/auth fields** and determine whether password hashes are actually present and compatible.
- [ ] **Step 2: If hashes are compatible, write failing tests** proving an imported existing hash authenticates the same user ID.
- [ ] **Step 3: If hashes are unavailable/incompatible, write failing tests** for a one-time controlled password-reset migration flow that preserves user ID and account data.
- [ ] **Step 4: Implement secure password hashing and session issuance** without exposing hashes or secrets to the browser.
- [ ] **Step 5: Replace frontend Blink auth calls** with the new auth API while preserving user-facing login behavior.
- [ ] **Step 6: Run authentication tests** including deactivated/banned users and session expiry.
- [ ] **Step 7: Commit** with `git add backend/auth backend/routes/auth.ts backend/lib/auth.ts && git commit -m "feat: replace Blink authentication"`.

---

### Task 6: Replace Blink reads/writes in core economy routes

**Files:**
- Modify: `backend/routes/packOpening.ts`
- Modify: `backend/routes/inventory.ts`
- Modify: `backend/routes/upgrader.ts`
- Modify: `backend/routes/exchanger.ts`
- Modify: `backend/routes/battles/index.ts`
- Modify: related backend route modules using Blink DB directly
- Test: corresponding route test files

**Interfaces:**
- Consumes: Task 2 repositories, Task 4 atomic wallet, Task 5 auth.
- Produces: economy routes that use PostgreSQL repositories and no longer require `@blinkdotnew/sdk` for database access.

- [ ] **Step 1: Write failing integration tests** for pack opening, selling, sell-all, upgrader, exchanger, battle entry/join/result, and refunds against PostgreSQL.
- [ ] **Step 2: Replace direct Blink database calls** with repositories one route/domain at a time.
- [ ] **Step 3: Preserve existing PF selection and audit payloads** while moving persistence to PostgreSQL.
- [ ] **Step 4: Run economy integration tests** and verify balances, inventory, and audit records remain consistent.
- [ ] **Step 5: Commit** with `git add backend/routes && git commit -m "refactor: move economy routes to PostgreSQL"`.

---

### Task 7: Move Stripe/Coinbase and cashout persistence off Blink

**Files:**
- Modify: `backend/routes/stripe.ts`
- Modify: `backend/routes/coinbase.ts`
- Modify: `backend/routes/cashout.ts`
- Modify: `backend/routes/cashoutAdmin.ts`
- Modify: payment helpers
- Test: payment and cashout integration tests

**Interfaces:**
- Consumes: Task 4 wallet transaction, Task 2 transaction/cashout repositories.
- Produces: provider webhooks and cashout flows whose persistent state is PostgreSQL and whose provider events are idempotent.

- [ ] **Step 1: Write failing tests** for duplicate Stripe webhook delivery, duplicate Coinbase events, first-deposit bonus, referral reward, and cashout state transitions.
- [ ] **Step 2: Replace Blink transaction/user/cashout persistence** with PostgreSQL repositories.
- [ ] **Step 3: Enforce provider-event idempotency** with unique provider identifiers.
- [ ] **Step 4: Run payment tests** without real money using provider test fixtures/mocks.
- [ ] **Step 5: Commit** with `git add backend/routes backend/lib && git commit -m "refactor: move payment persistence to PostgreSQL"`.

---

### Task 8: Replace Blink realtime and remaining frontend database access

**Files:**
- Modify: frontend auth/balance/pack/inventory/battle/support hooks and components identified by the Blink-reference audit
- Create: `backend/realtime/*`
- Test: realtime and frontend integration tests

**Interfaces:**
- Consumes: PostgreSQL-backed API from Tasks 5–7.
- Produces: frontend updates for balance, battles, support, inventory, and other live state without Blink.

- [ ] **Step 1: Add failing tests** for live balance update, battle state update, support message update, and reconnect behavior.
- [ ] **Step 2: Implement the chosen realtime transport** behind a small backend interface.
- [ ] **Step 3: Replace direct `blink.db` frontend access** with API calls and realtime subscriptions.
- [ ] **Step 4: Run frontend tests and a local end-to-end smoke test.**
- [ ] **Step 5: Commit** with `git add src backend/realtime && git commit -m "refactor: remove Blink realtime and frontend database access"`.

---

### Task 9: Remove Blink runtime dependency and add production configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: deployment/server configuration
- Modify: `.env.example`
- Test: build/startup tests

**Interfaces:**
- Consumes: completed PostgreSQL/auth/realtime replacement.
- Produces: a production build that can run without Blink credentials or the Blink SDK.

- [ ] **Step 1: Write a startup test** proving the application fails clearly when required PostgreSQL/auth/payment environment variables are absent and does not require Blink variables.
- [ ] **Step 2: Remove `@blinkdotnew/sdk`** only after all runtime references have been removed.
- [ ] **Step 3: Update environment documentation** with placeholders only; never include real credentials.
- [ ] **Step 4: Run typecheck, build, tests, and local startup.**
- [ ] **Step 5: Commit** with `git add package.json package-lock.json .env.example && git commit -m "refactor: remove Blink runtime dependency"`.

---

### Task 10: Production migration rehearsal and cutover gate

**Files:**
- Create: `scripts/migration/run-rehearsal.ts`
- Create: `scripts/migration/run-reconciliation.ts`
- Create: `docs/migration/cutover-runbook.md`
- Test: end-to-end migration suite

**Interfaces:**
- Consumes: exported data, PostgreSQL deployment, completed application.
- Produces: signed-off reconciliation report and repeatable cutover/rollback procedure.

- [ ] **Step 1: Restore the complete export into a disposable PostgreSQL instance.**
- [ ] **Step 2: Run reconciliation** for every migrated table plus user counts, wallet balances, inventory totals, transaction totals, cashout states, and PF history.
- [ ] **Step 3: Run end-to-end tests** for signup/login, existing-user login, deposits, bonuses, pack opening, selling, upgrader, exchanger, battles, cashout, admin functions, and support.
- [ ] **Step 4: Run PF verification** against historical `packs_opened`, `upgrader_spins`, and battle audit records.
- [ ] **Step 5: Load-test concurrent wallet/economy operations** and verify no balance or inventory corruption.
- [ ] **Step 6: Document final-sync, traffic-cutover, monitoring, and rollback steps.**
- [ ] **Step 7: Do not cut over production** until all reconciliation and test gates pass and the project owner explicitly approves the cutover.
- [ ] **Step 8: Commit** with `git add scripts/migration docs/migration && git commit -m "docs: add PocketPull migration rehearsal and cutover runbook"`.
