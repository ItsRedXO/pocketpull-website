# Admin PostgreSQL Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Admin Panel use the Railway/PostgreSQL backend for all database reads and mutations instead of the legacy Blink backend.

**Architecture:** Keep the existing `blink.db` compatibility surface, but make its PostgreSQL adapter complete enough for admin usage. The browser sends the dedicated admin-session secret when present; the backend validates that secret and performs the requested PostgreSQL operation. Admin-only HTTP log endpoints also run against PostgreSQL.

**Tech Stack:** React/TypeScript, Hono, PostgreSQL/pg, Vite, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-postgres-cutover-design.md`

## Global Constraints

- Production data source is PostgreSQL on Supabase.
- Railway remains the production backend/frontend host.
- Blink authentication remains in place during this phase.
- Preserve existing Admin Panel behavior and UI.
- Do not expose admin operations to non-admin users.

---

### Task 1: Add failing regression coverage for the PostgreSQL browser adapter

**Files:**
- Create: `backend/adminPostgresAdapter.test.ts`
- Modify: `src/lib/postgresDb.ts`

- [ ] **Step 1: Write the failing test** for `count`, `upsert`, and the dedicated admin secret header contract using a mocked global `fetch`.
- [ ] **Step 2: Run the focused test** with `npx tsx --test backend/adminPostgresAdapter.test.ts` and confirm failure because the adapter currently has no `count` and no admin header support.
- [ ] **Step 3: Implement the minimal adapter changes.**
- [ ] **Step 4: Re-run the focused test and confirm green.**

### Task 2: Complete backend DB-proxy support required by Admin Panel

**Files:**
- Modify: `backend/routes/dbProxy.ts`
- Modify: `backend/lib/postgresBlinkDb.ts`
- Modify: `backend/routes/supportDbProxy.ts`

- [ ] **Step 1: Add failing backend contract coverage** for admin count/upsert and support-table column mapping.
- [ ] **Step 2: Verify the new test fails against current proxy behavior.
- [ ] **Step 3: Implement admin count/upsert handling and real support column definitions.
- [ ] **Step 4: Verify the focused backend tests pass.

### Task 3: Route Admin Panel logs through Railway

**Files:**
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/UsersTab.tsx`
- Modify: `src/admin/PacksTab.tsx`
- Modify: `src/admin/CashOutsTab.tsx`
- Modify: `src/admin/LogsTab.tsx`
- Modify: `src/admin/BalanceReconciliation.tsx`
- Modify: any additional `src/admin/**` file containing the legacy Blink API URL
- Modify: `backend/routes/logs.ts` if required for authenticated admin logging

- [ ] **Step 1: Add/extend a shared admin API helper using `BACKEND_BASE` and the admin-session secret.
- [ ] **Step 2: Replace hardcoded legacy Blink log calls.
- [ ] **Step 3: Ensure log reads and writes target PostgreSQL.
- [ ] **Step 4: Run typecheck/build and verify no production admin source still contains the legacy Blink API base.

### Task 4: Verify the whole Admin Panel contract

**Files:**
- Modify: `.github/workflows/postgres-migration-ci.yml`
- Create: `backend/adminPanelContract.test.ts` if useful for the final regression suite

- [ ] **Step 1: Add the admin contract test to CI.
- [ ] **Step 2: Run the full CI-equivalent test/typecheck/build sequence.
- [ ] **Step 3: Confirm the final branch has no unintended Blink database/API dependencies in `src/admin`.
- [ ] **Step 4: Open the PR to `main` only after fresh verification.
