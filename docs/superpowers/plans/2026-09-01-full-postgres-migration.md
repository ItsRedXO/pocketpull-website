# Full PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PostgreSQL the authoritative persistence layer for every PocketPull application feature while preserving the existing API contracts and keeping production isolated on the migration branch.

**Architecture:** Keep the existing Hono route surface and frontend contracts. Route business state through `backend/db/repositories/*` and PostgreSQL transactions; retain external providers only for their actual external responsibilities (Stripe/Coinbase/email and, temporarily, JWT verification). Remove application-data reads/writes through Blink and ensure money/card mutations are transactional and idempotent.

**Tech Stack:** TypeScript, Hono, Node server adapter, PostgreSQL via `pg`, Vitest, Stripe, Coinbase, existing Blink JWT verification bridge.

**Spec:** `docs/superpowers/plans/2026-09-01-full-postgres-migration.md`

## Global Constraints

- Work only on `migration/postgres-foundation`; do not merge or deploy to `main`.
- PostgreSQL is authoritative for users, wallet, transactions, inventory, packs, pack openings, battles, upgrader, exchanger, cashout, referrals, and application logs.
- Existing HTTP endpoints and response shapes remain compatible unless a current implementation is demonstrably unsafe or impossible.
- Money/card mutations must be atomic and idempotent where external retries are possible.
- Provably-fair selection must remain deterministic from the persisted seed/nonce inputs.
- Do not expose secrets or copy `.env` values into source control.

---

### Task 1: Establish the migration inventory and database contract

**Files:**
- Modify: `backend/db/schema.sql`
- Modify: `backend/db/migrations/*` as needed for missing tables/indexes/constraints
- Modify: `backend/db/repositories/users.ts`
- Modify: `backend/db/repositories/transactions.ts`
- Modify: `backend/db/repositories/wallet.ts`
- Test: `backend/db/client.test.ts`, `backend/db/repositories/wallet.test.ts`

- [ ] **Step 1: Enumerate every route and repository that persists application state.**
- [ ] **Step 2: Add missing PostgreSQL schema/index/constraint coverage for the identified flows.**
- [ ] **Step 3: Add repository methods for user state, transaction history, and wallet reads needed by routes.**
- [ ] **Step 4: Add focused tests for atomic balance changes, idempotency keys, and account-state reads.**
- [ ] **Step 5: Run the DB test subset and TypeScript compilation.**
- [ ] **Step 6: Commit as `feat: complete postgres core repositories`.**

### Task 2: Finish packs and pack-opening persistence

**Files:**
- Modify: `backend/routes/packOpeningPostgres.ts`
- Modify: `backend/db/repositories/packOpening.ts`
- Modify: `backend/db/repositories/packs.ts`
- Modify: `backend/db/repositories/provablyFair.ts`
- Test: new focused pack-opening repository/route tests

- [ ] **Step 1: Verify pack, card quantity, cooldown, nonce, odds snapshot, inventory, wallet, and audit writes all use PostgreSQL.**
- [ ] **Step 2: Make the entire opening settlement one transaction with row/advisory locking.**
- [ ] **Step 3: Ensure Mystery Pack quantity depletion and standard pack quantity limits cannot race.**
- [ ] **Step 4: Add tests for concurrent opens, sold-out cards, stale price rejection, cooldown races, and nonce increments.**
- [ ] **Step 5: Commit as `feat: harden postgres pack opening`.**

### Task 3: Finish inventory and exchanger

**Files:**
- Modify: `backend/routes/inventory.ts`
- Modify: `backend/db/repositories/inventory.ts`
- Modify: `backend/routes/exchanger.ts`
- Modify: `backend/db/repositories/exchanger.ts`
- Test: focused inventory/exchanger tests

- [ ] **Step 1: Verify every inventory read/mutation used by the frontend comes from PostgreSQL.**
- [ ] **Step 2: Make sell and sell-all atomic with wallet credit and inventory deletion.**
- [ ] **Step 3: Make exchanger trades lock offered inventory and target pack cards before committing.**
- [ ] **Step 4: Preserve lock/favorite ownership checks and prevent double-spend/replay.**
- [ ] **Step 5: Run focused tests and commit as `feat: complete postgres inventory and exchanger`.**

### Task 4: Finish upgrader and provably-fair records

**Files:**
- Modify: `backend/routes/upgrader.ts`
- Modify: `backend/db/repositories/upgrader.ts`
- Modify: `backend/routes/provablyFair.ts`
- Modify: `backend/db/repositories/provablyFair.ts`
- Test: focused upgrader/provably-fair tests

- [ ] **Step 1: Verify selected inventory cards and target cards are loaded and locked from PostgreSQL.**
- [ ] **Step 2: Ensure balance/card settlement and audit records are one transaction.**
- [ ] **Step 3: Replace any remaining non-deterministic result generation in the upgrader path with the existing provably-fair primitives.**
- [ ] **Step 4: Add tests for win/loss, balance spending, ownership, replay, and deterministic rolls.**
- [ ] **Step 5: Commit as `feat: complete postgres upgrader`.**

### Task 5: Complete pack battles

**Files:**
- Modify: `backend/routes/battles/*.ts`
- Modify: `backend/db/repositories/battleCreate.ts`
- Modify: `backend/db/repositories/battleExecute.ts`
- Modify: `backend/db/repositories/battles.ts`
- Test: focused battle repository/route tests

- [ ] **Step 1: Audit lobby creation/join/leave/start/execute paths for any remaining application-data provider calls.**
- [ ] **Step 2: Make lobby state, entry fees, participant ownership, and settlement PostgreSQL transactions.**
- [ ] **Step 3: Preserve Standard/Underdog/Shared behavior and the existing constrained distribution algorithm.**
- [ ] **Step 4: Ensure bot rewards and player rewards settle to the correct PostgreSQL user records.**
- [ ] **Step 5: Add concurrency/replay tests for joins, starts, and execution.**
- [ ] **Step 6: Commit as `feat: complete postgres pack battles`.**

### Task 6: Migrate payments and wallet crediting

**Files:**
- Modify: `backend/routes/stripe.ts`
- Modify: `backend/routes/coinbase.ts`
- Modify: `backend/lib/payments.ts`
- Modify: `backend/lib/wallet.ts`
- Modify: `backend/db/repositories/transactions.ts`
- Modify: `backend/db/repositories/wallet.ts`
- Test: payment/wallet idempotency tests

- [ ] **Step 1: Keep Stripe/Coinbase as external payment providers while moving user/payment transaction state to PostgreSQL.**
- [ ] **Step 2: Make webhook processing idempotent using provider event/payment identifiers stored in PostgreSQL.**
- [ ] **Step 3: Move first-deposit bonus and referral reward state changes into PostgreSQL transactions.**
- [ ] **Step 4: Ensure matched-balance semantics remain unchanged.**
- [ ] **Step 5: Add retry/double-webhook tests.**
- [ ] **Step 6: Commit as `feat: migrate payment persistence to postgres`.**

### Task 7: Migrate cashout and admin cashout

**Files:**
- Modify: `backend/routes/cashout.ts`
- Modify: `backend/routes/cashoutAdmin.ts`
- Add/modify: `backend/db/repositories/cashout.ts`
- Modify: `backend/db/schema.sql` / migrations if required
- Test: cashout transaction tests

- [ ] **Step 1: Store cashout requests, selected card snapshots, shipping fields, status, and timestamps in PostgreSQL.**
- [ ] **Step 2: Atomically validate ownership/unlocked state, create the request, and remove the cards.**
- [ ] **Step 3: Move admin list/status/update operations to PostgreSQL with authorization checks.**
- [ ] **Step 4: Keep email delivery non-authoritative and retry-safe.**
- [ ] **Step 5: Add tests for duplicate submissions, locked cards, insufficient value, and admin transitions.**
- [ ] **Step 6: Commit as `feat: migrate cashout persistence to postgres`.**

### Task 8: Migrate referrals, users, logs, and email audit persistence

**Files:**
- Modify: `backend/index.ts`
- Modify: `backend/lib/auth.ts`
- Modify: `backend/lib/emailLogging.ts`
- Modify: `backend/routes/logs.ts`
- Modify: `backend/routes/sendTestEmails.ts`
- Modify: `backend/db/repositories/users.ts`
- Add/modify: repositories for referrals/logs/email audit
- Test: user/referral/log persistence tests

- [ ] **Step 1: Remove the remaining Blink DB referral implementation from `backend/index.ts`.**
- [ ] **Step 2: Implement referral pagination/status/qualification reads against PostgreSQL transactions and users.**
- [ ] **Step 3: Move application activity logs and outbound-email audit records to PostgreSQL.**
- [ ] **Step 4: Keep the Blink SDK only where it is strictly required for JWT verification, if no replacement is yet available.**
- [ ] **Step 5: Add tests for referral qualification and log/email persistence.**
- [ ] **Step 6: Commit as `feat: migrate referrals and application logs to postgres`.**

### Task 9: Make the backend runtime explicit and production-ready

**Files:**
- Modify: `backend/index.ts`
- Add: `backend/server.ts`
- Modify: `package.json`
- Modify: `vite.config.ts` only if API proxying is required for local development
- Add/modify: environment documentation

- [ ] **Step 1: Expose the Hono app through `@hono/node-server` for Node execution.**
- [ ] **Step 2: Add a backend start script that loads the configured PostgreSQL environment without bundling secrets.**
- [ ] **Step 3: Preserve the Vite frontend dev workflow and local API routing.**
- [ ] **Step 4: Add a health check that distinguishes API availability from PostgreSQL availability.**
- [ ] **Step 5: Verify production build and backend startup contract.**
- [ ] **Step 6: Commit as `feat: add explicit node backend runtime`.**

### Task 10: Remove remaining application-data Blink dependencies and perform final verification

**Files:**
- Modify every remaining production-path file identified by the dependency audit
- Modify: `README.md` / migration documentation
- Test: full test suite and migration audit script

- [ ] **Step 1: Search the backend for every `blink.db` application-data access and classify each occurrence as migrated, external-only, or invalid.**
- [ ] **Step 2: Remove all invalid application-data Blink calls.**
- [ ] **Step 3: Add a migration audit script that fails if forbidden Blink DB patterns remain in production backend routes/repositories.**
- [ ] **Step 4: Run all Vitest tests, TypeScript compilation, and the Vite production build.**
- [ ] **Step 5: Verify Git status is clean and the migration branch contains only intended commits.**
- [ ] **Step 6: Commit as `chore: finalize postgres migration audit`.**
