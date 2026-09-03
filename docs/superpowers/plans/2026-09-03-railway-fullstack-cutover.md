# Railway Full-Stack Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Railway serve PocketPull's production frontend and PostgreSQL-backed API so Blink is no longer required for production hosting.

**Architecture:** Convert the existing Railway Docker image from backend-only to a two-stage frontend build plus Node/Hono runtime. The runtime serves Vite's `dist` assets and SPA fallback while preserving every API route and `/health`; frontend API traffic continues targeting the Railway backend URL unless `VITE_BACKEND_URL` is explicitly supplied.

**Tech Stack:** Vite + React + TypeScript, Hono, `@hono/node-server`, Node 22, Docker, Railway, PostgreSQL/Supabase.

**Spec:** `docs/superpowers/specs/2026-09-03-railway-fullstack-cutover-design.md`

## Global Constraints
- PostgreSQL remains the single source of truth for application data.
- Blink is not used for production hosting or application database traffic.
- Blink authentication/JWT verification remains intact unless separately migrated.
- No secrets or credentials are committed.
- Existing API routes and business behavior remain unchanged.
- Railway health check remains `/health`.
- `dist` remains build output and is not committed.

---

### Task 1: Add test coverage for Railway frontend serving
**Files:** Create `backend/frontendServing.test.ts`.

- [ ] Write a failing integration test that creates a temporary `dist/index.html`, imports the Hono app, and verifies `/` returns the compiled document.
- [ ] Add an SPA-route assertion such as `/admin` returning the same compiled document.
- [ ] Add an API-order assertion that `/health` still returns the PostgreSQL health response shape when the frontend middleware is present.
- [ ] Run the test and confirm it fails because the current backend-only app does not serve frontend files.

### Task 2: Serve the Vite build from Hono
**Files:** Modify `backend/index.ts`.

- [ ] Import `serveStatic` from `@hono/node-server/serve-static`.
- [ ] Add static-file middleware rooted at `./dist` after API routes so existing API handlers retain priority.
- [ ] Add an SPA fallback for GET requests that are not API routes and do not map to a real static asset.
- [ ] Ensure `/health`, `/db`, `/battles`, payments, pack opening, upgrader, exchanger, cashout, and other API routes cannot be replaced by `index.html`.
- [ ] Run the new frontend-serving tests and make them pass.

### Task 3: Build frontend into the Railway image
**Files:** Modify `Dockerfile.backend`, `railway.json`.

- [ ] Convert the Dockerfile to a multi-stage build.
- [ ] Builder stage installs dependencies and runs `npm run build` with the Railway backend URL as the production fallback.
- [ ] Runtime stage installs production dependencies and copies `backend`, `dist`, and required TypeScript/runtime configuration.
- [ ] Keep `npm run db:migrate` as the Railway pre-deploy command and `/health` as the health check.
- [ ] Ensure the final image starts the same Hono server on Railway's `$PORT`.

### Task 4: Remove the legacy frontend build fallback
**Files:** Modify `vite.config.ts`.

- [ ] Replace the legacy Blink backend fallback with the Railway backend URL.
- [ ] Preserve `VITE_BACKEND_URL` as an explicit override for local/preview environments.
- [ ] Verify a production build contains the Railway backend target and no legacy Blink backend URL.

### Task 5: Verify and merge
**Files:** Modify `.github/workflows/postgres-migration-ci.yml` if needed.

- [ ] Run the frontend-serving tests.
- [ ] Run TypeScript verification for backend files.
- [ ] Run the Vite production build.
- [ ] Build the Docker image.
- [ ] Verify `/health`, `/`, and an SPA route against the built application.
- [ ] Verify the legacy Blink backend URL is absent from `dist`.
- [ ] Review the complete diff for unintended frontend/API changes.
- [ ] Open a PR to `main` and merge only after verification is green.

### Task 6: Railway production cutover
- [ ] Allow Railway to deploy the merged `main` commit.
- [ ] Confirm the Railway deployment is healthy.
- [ ] Confirm the Railway public URL serves the PocketPull frontend instead of `404 Not Found`.
- [ ] Point the existing PocketPull custom domain at Railway only after the Railway frontend is verified.
- [ ] Confirm Blink hosting can remain paused without affecting the Railway production site.
