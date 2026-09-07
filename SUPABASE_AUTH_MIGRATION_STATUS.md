# Supabase Auth Migration — Status (as of 2026-09-06, Phase 2 complete)

## Goal
Final architecture: GitHub (source) → Railway (backend/API) → Supabase (Postgres + Supabase Auth).
Blink retained ONLY for the domain/URL. Full plan: see chat history / PR #27 description.
Phase 0 (identity model) approved: keep existing `usr_XXXX` app IDs, link via `auth_user_id`.

## Done
1. **Supabase schema** — `public.users.auth_user_id uuid UNIQUE NULL REFERENCES auth.users(id) ON DELETE SET NULL`
   applied directly to production DB (project `etyeqpwxwuzdplptetwh`). Additive only, verified: all 321
   existing rows untouched, 29 other columns unchanged, 0 rows linked yet.
2. **Pilot account identified**: `usr_YZHIwRCxVfoM` (username `ItsRedXO`, email `lopezdavid689@yahoo.com`,
   balance `$9,537.45` at time of audit).
3. **Supabase Auth user created** for that email (via Dashboard, auto-confirmed). `auth.users.id` =
   `73b591e1-0034-422b-b367-e270816786d7`.
4. **GitHub write access** obtained (fine-grained PAT, used only for git push + PR creation, not stored).
5. **Branch `feat/supabase-auth-phase1`** pushed, containing:
   - `backend/lib/supabaseAuth.ts` — verifies Supabase JWTs (JWKS-first, HS256/`SUPABASE_JWT_SECRET`
     fallback — **not yet confirmed which mode this project actually needs**, since the sandbox used to
     build this has no network access to supabase.co; must be checked against real logs once deployed).
   - `backend/routes/authSupabase.ts` — two new, additive routes:
     - `POST /auth/link-supabase` — links Supabase identity to existing account (requires both a valid
       Blink token AND a valid Supabase token, matching email; only sets `auth_user_id` if currently NULL).
     - `GET /auth/whoami-supabase` — read-only, Supabase-token-only, resolves to the linked account. **This
       is the acceptance-test endpoint** for the migration gate the user set: prove a real account
       authenticates via Supabase and resolves to correct balance/permissions before touching Blink.
   - `.env.example` updated to document `SUPABASE_URL` (public) and `SUPABASE_JWT_SECRET` (secret, only
     if needed).
   - Wired into `backend/index.ts` (one import + one `app.route('/', authSupabaseRoutes)` line).
   - Typechecked clean (`tsc --noEmit`), module import smoke-tested locally.
6. **PR #27 opened** against `main`: `https://github.com/ItsRedXO/pocketpull-website/pull/27` — **NOT
   merged**. Do not merge until pilot verification (below) succeeds.

## In progress / next step (not yet done)
- Discovered the Railway **staging** environment already exists and already deploys from a git branch
  literally called `staging` — which is NOT stale, it's a **substantially diverged branch** with unrelated
  work (battle payout fixes, a `.github/workflows/publish-production.yml`, coinbase/stripe/inventory
  changes). Confirmed none of it overlaps with the files this migration touches, and confirmed
  `backend/index.ts` is identical between `main` and `staging`, so merging is expected to be conflict-free.
- **Decided against** using `Railway:connect-service-source` to repoint staging's branch — that tool
  applies to **all environments at once**, which risks silently repointing production too. Do not use it
  for this.
- **Plan**: `git merge feat/supabase-auth-phase1` into `staging` (real merge, not force-push, preserves
  staging's existing unrelated work), push to `origin/staging`. Railway's existing staging config
  (`source.branch = "staging"`) will auto-deploy it with zero changes to any Railway environment config
  and zero risk to production. **This merge was prepared but not yet pushed as of this status doc.**

## Phase 1 pilot verification — COMPLETE (2026-09-06)
1. ✅ `SUPABASE_URL` set on Railway **staging only** (not production).
2. ✅ Confirmed via live test: this Supabase project uses modern JWKS-based (asymmetric) JWT signing —
   verification succeeded with no `SUPABASE_JWT_SECRET` set at all. That env var / HS256 fallback path
   in `supabaseAuth.ts` is not needed for this project; can be left as unused defensive code or removed
   later.
3. ✅ Red signed in as `lopezdavid689@yahoo.com` via real `supabase.auth` password grant, got a valid
   access token.
4. ✅ Confirmed live on Railway staging: `GET /auth/whoami-supabase` with that token returned
   `404 "No PocketPull account is linked to this Supabase identity yet"` — proving the JWT verification
   path works end-to-end on the deployed backend (this is a *success* signal: 404 only fires after
   token verification succeeds; a bad/invalid token would be 401).
5. ✅ Linked directly via one Supabase SQL statement (pre-approved action — "adding/linking the new auth
   UUID field"), rather than round-tripping the Blink-token half of `/auth/link-supabase` through the
   browser: `UPDATE users SET auth_user_id = '73b591e1-0034-422b-b367-e270816786d7' WHERE id =
   'usr_YZHIwRCxVfoM' AND auth_user_id IS NULL`.
6. ✅ Verified resolution using the exact query `/auth/whoami-supabase` runs: resolves to
   `usr_YZHIwRCxVfoM`, balance `9537.450000` (matches original audit exactly), `role: admin`,
   88 inventory rows, 374 wallet_transactions, 1487 transactions. **Nothing else was modified.**

**Gate met**: a real existing account authenticates through Supabase and resolves to its original
`usr_XXXX` account with correct balance/inventory/transactions/permissions. Blink auth has NOT been
touched, removed, or disabled — it remains the only live auth path for all other users. Cleared to
proceed to Phase 2.

## Phase 2 — backend JWT verification cutover — COMPLETE (2026-09-06)
Branch `feat/supabase-auth-phase2` (based on `feat/supabase-auth-phase1`), **PR #28** opened against
`main`: `https://github.com/ItsRedXO/pocketpull-website/pull/28` — **NOT merged**. Do not merge until
the user reviews it (per the standing branch + PR constraint).

1. ✅ Added `resolveUserId(c)` in `backend/lib/auth.ts`: tries Blink token verification first (exact
   same call as before — zero behavior change for the ~70 not-yet-migrated accounts), and only if that
   fails, tries interpreting the same `Authorization` header as a Supabase Auth token and resolving it
   via `SELECT id FROM users WHERE auth_user_id=$1`. Returns `null` if both fail.
2. ✅ `requireAuth()` now calls `resolveUserId()` instead of calling Blink directly — this one change
   flows through to all ~17 files that already call `requireAuth()`, with no other edits needed there.
3. ✅ Replaced the ~10 independent `blink.auth.verifyToken` call sites (admin-role checks) with the
   same `resolveUserId()`, one function at a time, preserving each site's existing downstream role-check
   logic exactly (only the token-verification line changed): `adminLogs.ts`, `adminStats.ts`,
   `adminLogsGuard.ts`, `cashoutAdmin.ts`, `cashoutAdminV2.ts`, `upgraderSettings.ts`,
   `provablyFair.ts` (two sites: `verifyUserToken` and `isAdminRequest`), `dbProxy.ts`,
   `userDbProxy.ts`, `supportDbProxy.ts`.
4. ✅ Corrected a stale comment in `backend/lib/supabaseAuth.ts` that claimed HS256/`SUPABASE_JWT_SECRET`
   was "the one that's actually needed" — the Phase 1 pilot verification already proved this project uses
   JWKS with no secret needed; the comment now says so.
5. ✅ `tsc --noEmit`: 0 errors in any `backend/` file (47 pre-existing frontend-only errors are unchanged
   from the `main`/Phase 1 baseline — confirmed by running the same check on both branches).
6. ✅ Merged into `staging` (real merge, same pattern as Phase 1) and pushed — Railway auto-deployed it
   successfully. Verified on the live staging deployment:
   - `GET /health` → `200 {"status":"ok","database":"postgresql",...}`.
   - `GET /auth/whoami-supabase` with no token → `401 SUPABASE_TOKEN_MISSING` (unchanged from Phase 1).
   - `GET /referrals` (requireAuth-guarded) with no token and with a garbage bearer token → both
     `UNAUTHORIZED`, confirming the Blink-then-Supabase fallback correctly rejects invalid input on
     both paths rather than falsely authenticating.
   - `GET /admin/stats` with no auth → `401 UNAUTHORIZED` (admin-role-check refactor didn't loosen
     anything).
   - Did not re-test the pilot account's positive `/auth/whoami-supabase` path in this session (would
     require the pilot's live Supabase session token); that path's underlying code is unchanged from
     Phase 1, only the *lookup helper* it plugs into elsewhere (`resolveUserId`) is new.

**What Phase 2 does NOT do**: no destructive schema changes, no changes to balances/user records, Blink
auth not disabled (tried first everywhere), no frontend changes — the frontend still only ever issues
Blink tokens, so this new path carries zero real production traffic until Phase 3.

## Next: Phase 3 — frontend cutover (not started)
1. Get PR #28 reviewed and merged to `main` (user's call).
2. Frontend: for linked accounts, start issuing/attaching Supabase session tokens on the `Authorization`
   header instead of (or in addition to, during a transition) Blink tokens.
3. Backfill `auth_user_id` for the remaining real users (the 71-vs-321 distinction below) — needs a plan
   for how those users authenticate against Supabase (new password set? magic link? still open).
4. Only after Phase 3 is live and verified per-user: remove `BLINK_PROJECT_ID`/`BLINK_SECRET_KEY` and any
   remaining Blink auth code. Right now only 1 of 71 real accounts has an `auth_user_id` link, and the
   frontend has not been touched, so this is still far off.

## Hard constraints still in force (from the user, unchanged)
- No destructive schema changes.
- No modification to production balances/user records beyond the `auth_user_id` link.
- Do not remove/disable Blink auth until the pilot account fully verifies through Supabase.
- Branch + PR workflow (option A) — merges to `main` need the user's review/click, not automatic.

## Known open questions for whoever picks this up
- Does this Supabase project need JWKS or HS256 verification? (Untestable from an isolated sandbox;
  first real signal will be in Railway logs after staging deploy.)
- The 71-real-user vs 321-total-rows distinction matters for any future bulk backfill — only
  `is_deleted=0 AND is_bot=0 AND email IS NOT NULL` rows are real migration candidates.
