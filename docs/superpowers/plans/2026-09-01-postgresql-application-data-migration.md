# PostgreSQL Application Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove PocketPull's remaining direct Blink application-database dependencies and make PostgreSQL the sole application data store without changing production behavior.

**Architecture:** The backend owns PostgreSQL access through the existing provider-agnostic adapter. Frontend data hooks call backend APIs rather than database SDKs. Blink remains only where explicitly needed for non-database capabilities such as token verification, notifications, or storage during this migration phase.

**Tech Stack:** TypeScript, React, Hono, PostgreSQL (`pg`), Vite, TanStack Query, Node/tsx, existing Blink SDK only for non-DB capabilities.

**Spec:** `docs/superpowers/specs/2026-09-01-postgresql-application-data-migration-design.md`

## Global Constraints

- PostgreSQL configuration is provider-agnostic through `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`.
- Production must not be modified during migration development.
- Frontend must not directly access application database tables.
- Wallet and provably-fair operations must remain atomic/concurrency-safe.
- Existing UI and API behavior should remain compatible.
- Run focused tests after each migration unit and full verification before merge.

---

### Task 1: Remove frontend catalog database access

**Files:**
- Modify: `src/hooks/usePacks.ts`
- Modify: `src/admin/adminApi.ts` only if shared request helpers are required
- Test: `backend/routes/catalog.test.ts`

**Interfaces:**
- Consumes: `GET /catalog/packs`, `GET /catalog/packs/:packId/cards`, `GET /catalog/cooldowns`.
- Produces: `usePacks` and related hooks that consume HTTP JSON rather than `blink.db`.

- [ ] **Step 1: Add endpoint tests for catalog responses**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('catalog endpoints expose packs and cards through the backend', async () => {
  // Use the repository's existing Hono test helper/adapter and a test PostgreSQL database.
  // Assert the response contains active packs and ordered cards and never requires a Blink DB object.
});
```

- [ ] **Step 2: Run the focused test and verify the current direct-Blink path is covered**

Run: `bun run test:backend -- backend/routes/catalog.test.ts`
Expected: the test suite exposes any missing PostgreSQL fixture or route wiring needed by the migration.

- [ ] **Step 3: Replace `blink.db` reads in `usePacks` with backend requests**

Use the existing `VITE_BACKEND_URL` convention and preserve the existing return shapes expected by pack cards, cooldown displays, recent pulls, and pack-opening UI. Keep Blink auth only for obtaining the bearer token used by the backend.

- [ ] **Step 4: Run typecheck**

Run: `bun run lint:types`
Expected: PASS with no TypeScript errors caused by the hook migration.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePacks.ts backend/routes/catalog.test.ts
git commit -m "refactor: route pack catalog reads through postgres backend"
```

### Task 2: Migrate remaining frontend application-data hooks

**Files:**
- Modify: `src/hooks/*` files found by searching for `blink.db`
- Modify: matching backend route files under `backend/routes/`
- Test: focused backend route tests for each migrated resource

**Interfaces:**
- Consumes: authenticated backend API endpoints.
- Produces: frontend hooks with the same public return shapes as before.

- [ ] **Step 1: Inventory all remaining direct database references**

Run: `git grep -n "blink\.db" -- 'src/**/*.ts' 'src/**/*.tsx'`
Expected: a finite list of frontend application-data references grouped by inventory, profile, activity, referrals, battles, upgrader, exchanger, or other resources.

- [ ] **Step 2: Write focused failing tests for each backend endpoint that lacks PostgreSQL coverage**

For every resource, assert authenticated reads/writes use PostgreSQL and return the existing JSON contract. Tests must use deterministic fixtures and must not instantiate a Blink database client.

- [ ] **Step 3: Implement backend endpoints against the PostgreSQL adapter**

Preserve field names at the HTTP boundary where possible; perform snake_case/camelCase conversion only inside the adapter or route serializer.

- [ ] **Step 4: Replace each frontend direct DB call with the corresponding API request**

Keep React Query keys and cache invalidation semantics unchanged unless the old query depended on a database-only behavior that cannot be represented over HTTP.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `bun run test:backend`
Run: `bun run lint:types`
Expected: PASS.

- [ ] **Step 6: Verify no frontend direct DB access remains**

Run: `git grep -n "blink\.db" -- 'src/**/*.ts' 'src/**/*.tsx'`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/hooks backend/routes
 git commit -m "refactor: remove frontend blink database access"
```

### Task 3: Remove backend database compatibility leaks

**Files:**
- Modify: `backend/lib/auth.ts`
- Modify: `backend/routes/*.ts` where direct Blink DB semantics remain
- Modify: `backend/lib/db.ts` as needed for transactions and SQL helpers
- Test: `backend/lib/*.test.ts` and affected route tests

**Interfaces:**
- Consumes: PostgreSQL adapter and authentication token verifier.
- Produces: backend routes with no Blink DB dependency.

- [ ] **Step 1: Search backend for database delegation**

Run: `git grep -n -E "blink\.db|getBlinkServer\(.*\)\.db" -- 'backend/**/*.ts'`
Expected: remaining matches are converted to PostgreSQL adapter calls; `getBlinkServer` may remain only as a compatibility facade for auth/notifications/storage.

- [ ] **Step 2: Add regression tests asserting the adapter is the database boundary**

Tests must fail if a route requires a Blink DB object to perform application-data CRUD.

- [ ] **Step 3: Convert route-by-route database calls**

Prioritize pack opening, wallet, inventory, exchanger, upgrader, battles, cashout, referrals, admin packs, and provably-fair routes. Replace database-specific SQL placeholders with PostgreSQL parameter placeholders and use transactions where multiple writes must commit together.

- [ ] **Step 4: Run backend tests**

Run: `bun run test:backend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend
 git commit -m "refactor: enforce postgres as backend application database"
```

### Task 4: Harden transactional economy operations

**Files:**
- Modify: `backend/lib/wallet.ts`
- Modify: `backend/routes/packOpening.ts`
- Modify: `backend/routes/upgrader.ts`
- Modify: `backend/routes/exchanger.ts`
- Modify: `backend/routes/battles/*.ts`
- Test: matching `*.test.ts` files

**Interfaces:**
- Consumes: PostgreSQL transaction/client primitives.
- Produces: atomic balance, inventory, and item-quantity mutations.

- [ ] **Step 1: Write concurrency tests**

Cover two simultaneous pack opens against one spendable balance, two claims against the last Mystery Pack card, and simultaneous matched-balance spending. Expected invariant: balance cannot become negative and a single remaining card cannot be awarded twice.

- [ ] **Step 2: Run tests and confirm the race is reproducible or the invariant is currently unproven**

Run: `bun run test:backend`
Expected: tests fail or identify missing transaction isolation/locking coverage.

- [ ] **Step 3: Implement PostgreSQL transactions and row locks**

Use `BEGIN`, `SELECT ... FOR UPDATE`, guarded `UPDATE ... WHERE quantity > 0`, and `COMMIT`/`ROLLBACK` through the adapter. Keep provably-fair roll computation deterministic and outside any retry that could consume a second nonce.

- [ ] **Step 4: Re-run concurrency tests**

Run: `bun run test:backend`
Expected: PASS; each invariant holds under concurrent attempts.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/wallet.ts backend/routes/packOpening.ts backend/routes/upgrader.ts backend/routes/exchanger.ts backend/routes/battles
 git commit -m "fix: make economy mutations transactional in postgres"
```

### Task 5: Complete admin migration and storage boundary

**Files:**
- Modify: `backend/routes/adminPacks.ts`
- Modify: `src/admin/PostgresPackForm.tsx`
- Modify: `src/admin/adminApi.ts`
- Test: `backend/routes/adminPacks.test.ts`

**Interfaces:**
- Consumes: PostgreSQL pack/card CRUD endpoints and existing non-DB storage upload capability.
- Produces: admin pack manager with no Blink DB dependency.

- [ ] **Step 1: Add admin CRUD tests**

Cover list, create, update, delete, mystery-pack card quantities, and authorization. Tests must verify the PostgreSQL adapter is used.

- [ ] **Step 2: Remove any remaining `blink.db` access from admin routes/forms**

Retain Blink storage only for image upload if that storage remains the selected object-storage service; no admin pack/card metadata may be stored in Blink DB.

- [ ] **Step 3: Run admin tests and typecheck**

Run: `bun run test:backend -- backend/routes/adminPacks.test.ts`
Run: `bun run lint:types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/adminPacks.ts src/admin/PostgresPackForm.tsx src/admin/adminApi.ts
 git commit -m "refactor: complete postgres admin pack migration"
```

### Task 6: Migration/bootstrap verification

**Files:**
- Modify: `scripts/migrate-postgres.ts`
- Modify: `backend/db/*` or migration SQL files as required
- Create: `backend/migration-verification.test.ts`

**Interfaces:**
- Consumes: provider-agnostic PostgreSQL environment variables.
- Produces: repeatable schema bootstrap and verification against an empty PostgreSQL database.

- [ ] **Step 1: Add schema verification tests**

Verify every application table used by the backend exists and required unique/foreign-key/index constraints are present.

- [ ] **Step 2: Run migration twice against a clean test database**

Run: `bun run migrate:postgres` twice with test-only PostgreSQL credentials.
Expected: first run creates schema; second run completes without destructive changes or duplicate-object failures.

- [ ] **Step 3: Add a migration smoke test**

Create a test user, pack, card, wallet transaction, inventory item, provably-fair nonce/audit record, and admin pack record; read each back through the application adapter.

- [ ] **Step 4: Run full backend tests**

Run: `bun run test:backend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-postgres.ts backend
 git commit -m "test: verify postgres schema bootstrap"
```

### Task 7: Full repository verification and migration handoff

**Files:**
- Modify: `README.md` and deployment documentation only if required to document environment variables and staging startup.
- Test: full repository checks

**Interfaces:**
- Consumes: completed migration branch.
- Produces: verified migration branch ready for user/staging review; no production deployment.

- [ ] **Step 1: Search for remaining application DB dependencies**

Run: `git grep -n -E "blink\.db|\.db\.(users|inventory|packsCatalog|packCards|transactions|battles|serverSeeds|userNonces)" -- ':!docs/**'`
Expected: no application-data database matches outside explicitly documented migration compatibility code.

- [ ] **Step 2: Run typecheck, lint, backend tests, and production build**

Run: `bun run lint:types`
Run: `bun run lint:js`
Run: `bun run test:backend`
Run: `bun run build`
Expected: all commands PASS.

- [ ] **Step 3: Verify production safety**

Confirm all migration commits target only `migration/postgresql`, no production secrets are committed, and no production database migration command was executed.

- [ ] **Step 4: Review the branch diff against main**

Run: `git diff --stat main...migration/postgresql`
Expected: changes are limited to PostgreSQL migration code, tests, documentation, and required frontend API routing.

- [ ] **Step 5: Commit final documentation changes**

```bash
git add README.md docs
 git commit -m "docs: document postgres migration verification"
```

- [ ] **Step 6: Stop before production deployment**

Do not merge to `main`, publish the application, or point production at the PostgreSQL database until the migration has been reviewed and a staging run has been completed.
