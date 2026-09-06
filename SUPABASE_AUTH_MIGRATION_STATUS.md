# Supabase Auth Migration — Status (as of 2026-09-06)

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

## Next: Phase 2 — backend JWT verification cutover (not started)
Per the full migration plan (see PR #27 description / prior chat):
1. Add a `verifySupabaseJwt(authHeader)` + `auth_user_id → usr_XXXX` lookup as the new source of truth
   inside `requireAuth()` in `backend/lib/auth.ts` — but only as an *additional* accepted path
   alongside the existing Blink verification, not a replacement, until Phase 3 frontend cutover is
   also live and tested per-user.
2. Replace the ~10 independent `blink.auth.verifyToken` call sites (admin-role checks) the same way.
3. Still branch + PR workflow, still staging-first, per your standing instructions.
4. Do NOT remove `BLINK_PROJECT_ID`/`BLINK_SECRET_KEY` or any Blink code until the 71 real users have
   actually been migrated to Supabase identities and the frontend cutover (Phase 3) is live and
   verified — right now only 1 of 71 real accounts has an `auth_user_id` link.

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
