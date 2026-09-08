# Blink → Supabase Auth Migration — Full Handoff (as of 2026-09-07)

This document is written to be read on its own, in a fresh conversation, with
no other context. If you are picking this up cold: read this whole file
before changing anything. Section 10 names the single next recommended step.

**Final architecture goal**: GitHub (source) → Railway (backend/API) →
Supabase (Postgres + Supabase Auth). Blink retained only for the
domain/URL registration, nothing else. The application's actual data
(`users`, `inventory`, `transactions`, etc.) already lives in a Railway
Postgres database — that migration happened before this auth migration
started and is not part of this document.

**Standing hard constraints** (unchanged since day one, still in force):
- No destructive schema changes.
- No modification to production balances/user records beyond the
  `auth_user_id` link column.
- Do not remove or disable Blink auth until every real user is migrated
  and verified.
- Branch + PR workflow; merges to `main` need explicit user approval,
  not automatic.

**Critical environment fact discovered during this work**: Railway's
`staging` and `production` deployments of this service **share one
physical Postgres database** (`DATABASE_URL` resolves to the same
instance for both). They are separate only in which git branch is
deployed and which frontend origin is served. There is no data isolation
between "testing on staging" and "production" — this was confirmed by
matching a live, millisecond-precision DB value (the active
provably-fair seed hash + timestamp) between the two environments. Keep
this in mind before treating anything as "just a staging test."

---

## 1. What we started with

Before this migration began:
- **Blink** (`@blinkdotnew/sdk`) was the sole authentication provider.
  The frontend (`src/hooks/useAuth.ts`, `src/lib/blink.ts`) calls
  `blink.auth.signInWithEmail`, `blink.auth.signUp`,
  `blink.auth.signOut`, `blink.auth.getValidToken()` directly against
  Blink's own cloud auth service (a real network call to Blink's
  servers, not proxied through our backend).
- The backend (`backend/lib/auth.ts`) verified every request via
  `requireAuth(c)`, which called `blink.auth.verifyToken(authHeader)` —
  a real HTTP call to Blink's `/api/auth/introspect` endpoint — and used
  the returned `userId` (Blink's own id, format `usr_XXXXXXXXXXXX`) as
  the account identity everywhere. ~17 backend route files call
  `requireAuth()` directly; another ~10 files independently duplicated
  `blink.auth.verifyToken(...)` inline for admin-role checks
  (`adminLogs.ts`, `adminStats.ts`, `adminLogsGuard.ts`,
  `cashoutAdmin.ts`, `cashoutAdminV2.ts`, `upgraderSettings.ts`,
  `provablyFair.ts` ×2, `dbProxy.ts`, `userDbProxy.ts`,
  `supportDbProxy.ts`).
- Application data already lived in Railway Postgres (`public.users`
  and friends), keyed by that same Blink `usr_XXXX` id as primary key.
  At the start of this migration: **321 total rows** in `public.users`,
  of which **71** are real candidate users for migration (the filter
  used throughout: `is_deleted=0 AND is_bot=0 AND email IS NOT NULL`).
- Reason for migrating: move off Blink's auth entirely, onto Supabase
  Auth, without any user-visible disruption and without touching
  balances/inventory/transactions.

---

## 2. Phase 1 — parallel Supabase JWT verification (additive only)

**Branch**: `feat/supabase-auth-phase1` · **PR**: [#27](https://github.com/ItsRedXO/pocketpull-website/pull/27) · **Merged**: yes (landed in `main` together with #28).

What shipped:
- **Schema**: `ALTER TABLE public.users ADD COLUMN auth_user_id uuid UNIQUE NULL REFERENCES auth.users(id) ON DELETE SET NULL` — applied directly to the (shared) production DB. Additive only; verified all 321 existing rows and 29 other columns were untouched, 0 rows linked at the time.
- **`backend/lib/supabaseAuth.ts`** (new): `verifySupabaseToken(token)` verifies a Supabase-issued JWT via JWKS (`jose` library, `createRemoteJWKSet` against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), falling back to an HS256/`SUPABASE_JWT_SECRET` path that turned out to be unused (see below). `extractSupabaseBearer(header)` pulls a bearer token out of a header value.
- **`backend/routes/authSupabase.ts`** (new): two routes, both additive, neither wired into any existing route —
  - `POST /auth/link-supabase` — requires **both** a valid Blink token (`Authorization` header) and a valid Supabase token (`X-Supabase-Token` header) whose verified email matches the account's email on file. Sets `auth_user_id` only if currently `NULL`. Idempotent.
  - `GET /auth/whoami-supabase` — accepts **only** a Supabase token, resolves it to the linked `usr_XXXX` account. This was the acceptance-test endpoint for the whole migration gate.
- **Pilot account**: `usr_YZHIwRCxVfoM` (username `ItsRedXO`, email `lopezdavid689@yahoo.com`, the site owner's own real account). A Supabase Auth user was created for that email via the Supabase dashboard (`auth.users.id = 73b591e1-0034-422b-b367-e270816786d7`).
- **Verification performed**: confirmed this Supabase project uses modern JWKS/asymmetric signing (no `SUPABASE_JWT_SECRET` needed — that code path is dead/defensive only). Pilot signed in via real `supabase.auth` password grant from a browser, `GET /auth/whoami-supabase` with that token correctly returned 404 ("no linked account") proving verification worked end-to-end before linking. The link was then applied via one direct, pre-approved SQL statement (not through `/auth/link-supabase`'s browser flow), and re-verified: `/auth/whoami-supabase` resolved to `usr_YZHIwRCxVfoM` with the correct balance ($9,537.45), 88 inventory rows, 374 wallet_transactions, 1487 transactions — an exact match to the pre-migration audit.
- **Env vars added**: `SUPABASE_URL` (public), `SUPABASE_JWT_SECRET` (secret, ended up unneeded).

At the end of Phase 1: Blink untouched and still the only live auth path for everyone; exactly 1 of 71 real accounts linked; nothing in Phase 1 was reachable from normal user traffic.

---

## 3. Phase 2 — backend accepts either token (still 100% Blink-driven traffic)

**Branch**: `feat/supabase-auth-phase2` · **PR**: [#28](https://github.com/ItsRedXO/pocketpull-website/pull/28) · **Merged**: yes.

What shipped:
- **`backend/lib/auth.ts`**: added `resolveUserId(c)` — tries
  `blink.auth.verifyToken()` first (byte-for-byte the same call as
  before, so zero behavior change for any Blink-authenticated request);
  only if that fails does it try `extractSupabaseBearer` +
  `verifySupabaseToken` on the same `Authorization` header, then
  `SELECT id FROM users WHERE auth_user_id=$1`. Returns `null` if both
  fail. `requireAuth()` was rewritten to call `resolveUserId()` instead
  of calling Blink directly — this one change automatically covers all
  ~17 files that call `requireAuth()`.
- All **10** independent `blink.auth.verifyToken(...)` call sites
  (listed in Section 1) were mechanically swapped to call
  `resolveUserId(c)` instead, preserving each site's own downstream
  role-check logic verbatim (only the token-verification line changed).
- After this PR, exactly **one** raw `blink.auth.verifyToken` call
  remains in the entire backend — inside `resolveUserId()` itself.
- Corrected a stale comment in `supabaseAuth.ts` that had claimed HS256
  was "the one that's actually needed" (Phase 1 already proved
  otherwise).
- No new database writes anywhere in this diff — confirmed by grepping
  the diff for `INSERT|UPDATE|DELETE`: zero matches. The only new query
  is the read-only `SELECT id FROM users WHERE auth_user_id=$1`.

This was reviewed in detail in-session (line-by-line diff audit) before
merge approval: confirmed fail-closed (no default/fallback identity if
both verification paths fail), confirmed a Supabase token from a
different Supabase project or an unlinked identity cannot resolve to
any account, confirmed zero behavior change for the ~70 not-yet-linked
accounts (Blink path always tried first, returns immediately on
success).

At the end of Phase 2: the frontend had not been touched at all and
still only ever sends Blink tokens (`src/lib/api.ts`'s
`getAuthHeaders()` called `blink.auth.getValidToken()` exclusively), so
the new Supabase-acceptance path in `resolveUserId` was still 100%
inert for real traffic — exercised only by the pilot's manual
`/auth/whoami-supabase` testing.

**Also merged around this time, unrelated to the auth migration itself**: [PR #29](https://github.com/ItsRedXO/pocketpull-website/pull/29), "Fix full-project typecheck" — `react`/`react-dom` were never declared as direct dependencies (pulled in transitively only), `@types/react`/`@types/react-dom` were missing entirely, masking ~20 real bugs under `noImplicitAny:false`. Fixed the dependency gap and the newly-surfaced bugs (event handlers passed by reference instead of wrapped, a Stripe layout option typo, framer-motion `ease` typing, etc.). Kept as its own PR deliberately, same reasoning as every other non-auth fix below: don't bloat the auth PRs with unrelated changes.

---

## 4. Phase 3 — silently link real accounts to Supabase on next login

**Branch**: `feat/supabase-auth-phase3` · **PR**: [#30](https://github.com/ItsRedXO/pocketpull-website/pull/30) · **Merged**: yes.

The open question from Phase 2 was: how do the other 70 real users ever
get a linked Supabase identity? Three options were considered (silent
migration on next login / magic-link email / forced password reset).
**Decision made by the user**: silent migration on next login — zero
friction, no email, no action required from anyone.

Architecture constraint this ran into immediately: `signInWithEmail`
runs entirely in the browser, straight to Blink's servers — the Railway
backend is never in that request path and never sees a plaintext
password today. Silently migrating a password therefore requires the
**frontend** to also send the password (once, right after a successful
Blink login) to a new backend endpoint, which uses it to create/set the
matching Supabase credential via the Supabase **Admin API**. This is a
real, deliberate change in exposure surface (discussed with and
approved by the user before implementation) — one specific endpoint now
receives a plaintext password, uses it once to call Supabase's Admin
API, and never stores it.

What shipped:
- **`backend/lib/supabaseAdmin.ts`** (new): `getOrCreateSupabaseIdentity(email, password)` — server-only, uses `SUPABASE_SERVICE_ROLE_KEY` (a new, highly privileged secret, separate from the public `SUPABASE_URL`/anon key). Calls the Supabase Admin API's `createUser({email, password, email_confirm:true})`; on an `email_exists` error, paginates `listUsers()` to find the existing identity instead (never overwrites an existing identity's password via this path — protects the pilot's manually-created identity from Phase 1).
- **`POST /auth/silent-migrate`** in `backend/routes/authSupabase.ts`: requires a valid Blink token (via `requireAuth`) plus `{password}` in the body. No-ops immediately (`{success:true, alreadyLinked:true}`) if `auth_user_id` is already set. Otherwise calls `getOrCreateSupabaseIdentity` and does the same `UPDATE users SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL` idempotent pattern as Phase 1's link route. **Always** returns a response (never throws past validation errors) — a failed migration must never block the user's actual login.
- **Frontend** (`src/hooks/useAuth.ts`): after a successful `blink.auth.signInWithEmail`, fires `silentlyMigrateToSupabase(password)` — unawaited by the caller, so it can never delay or fail the visible login.
- `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY`.

**A real, unrelated bug was found and fixed while testing this** (see
Section 8 for the full story — it's listed there because it's the kind
of thing a future reader needs to know about, even though it's already
fixed): brand-new signups were silently ending up with **no Postgres
row at all**, which made it impossible to test the happy path with a
fresh test account. Root-caused and fixed in [PR #32](https://github.com/ItsRedXO/pocketpull-website/pull/32).

**Also found and fixed in this window**: [PR #31](https://github.com/ItsRedXO/pocketpull-website/pull/31) — the login form is labeled "email or username" but `signIn()` passed whatever was typed straight to `blink.auth.signInWithEmail`, which only accepts real emails. Logging in with a username always failed. Fixed by resolving a bare username to its account email via the existing public `GET /auth/user-lookup` endpoint before calling Blink. Completely unrelated to the Supabase work; kept as its own PR.

**Full happy-path verification** (after PR #32's fix unblocked testing): created a throwaway test account, confirmed its Postgres row now gets created, logged in — `/auth/silent-migrate` returned `{"success":true,"migrated":true}` — and independently confirmed via direct Supabase SQL query that a real `auth.users` row was created at that exact timestamp. Logged in again: `{"success":true,"migrated":false,"alreadyLinked":true}` — confirmed idempotent, no duplicate identities.

At the end of Phase 3: still zero change to what token the frontend sends for API calls — this phase only backfills `auth_user_id`. As of this writing, **2 accounts total** have a linked Supabase identity: the pilot (`usr_YZHIwRCxVfoM`) and one throwaway test account (`usr_CC7fzQXN5240`, see Section 8 for why test accounts exist in the live database).

---

## 5. Phase 4 — frontend opportunistically prefers a live Supabase session

**Branch**: `feat/supabase-auth-phase4` · **PR**: [#33](https://github.com/ItsRedXO/pocketpull-website/pull/33) · **Merged**: yes.

With only ~1-2 of 71 real users linked at the time this started, a hard
cutover (force everyone onto Supabase sessions) would have locked out
essentially the entire real user base. The approach taken — proposed
and approved by the user — mirrors the backend's own Phase 2 dual-path
philosophy: **never block, only add a path**.

What shipped (current code, confirmed on `main` as of this writing):
- **`src/lib/supabase.ts`** (new): frontend Supabase client using only
  the public anon/publishable key — never the service-role key, which
  stays server-only (`backend/lib/supabaseAdmin.ts`). Built to be `null`
  (safe no-op) if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` aren't
  set, so it degrades to exactly today's behavior wherever it isn't
  configured.
- **`src/hooks/useAuth.ts`**: after a successful Blink login,
  `establishSupabaseSession(email, password)` runs (unawaited): it
  calls `silentlyMigrateToSupabase` (Phase 3) and then, best-effort,
  `supabase.auth.signInWithPassword({email, password})` — this only
  succeeds for accounts already linked (from this login's own
  migration, or a previous one). `signOutAll` now clears **both**
  sessions (`supabase.auth.signOut()` then `blink.auth.signOut()`) — a
  stale Supabase session must never outlive a Blink sign-out.
- **`src/lib/blink.ts`**: new exported `getPreferredAuthToken()` —
  checks for a live Supabase session first (`supabase.auth.getSession()`),
  falls back to `blink.auth.getValidToken()` otherwise. Wired into
  `blink.db`'s internal `tokenProvider`.
- **`src/lib/api.ts`**: `getAuthHeaders()` switched to call the same
  `getPreferredAuthToken()`, so both request paths in the app (the
  generic `/db` proxy used by `blink.db.*`, and the dedicated economy
  endpoints used by `api.ts`) are covered consistently — no
  half-cutover between the two.
- **`Dockerfile.backend` fix, same PR**: Railway passes service
  variables to the Docker build as build args, but a Dockerfile `ARG`
  only becomes a real environment variable inside the build stage (and
  therefore visible to Vite's `import.meta.env.VITE_*` inlining) if
  it's re-declared as `ENV` in that stage. Only `VITE_BACKEND_URL` had
  this treatment; `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` did not,
  so the first staging deploy silently shipped a `null` Supabase client
  even with the Railway variables set correctly. Added the matching
  `ARG`+`ENV` lines (confirmed present in `Dockerfile.backend` lines
  11-14 as of this writing). Confirmed by grepping the built JS bundle
  for the literal anon key string before and after the fix.

**Full end-to-end verification performed on staging** (after the
Dockerfile fix): logged in as the one fully-linked test account,
confirmed `localStorage['pocketpull-supabase-auth']` contained a real
session with a valid `access_token` for the correct email; intercepted
the actual outgoing `fetch` calls via a temporary in-page debugging
patch and confirmed the `/db` requests' `Authorization` header matched
the Supabase session's token exactly (`alg: ES256`, Supabase's
asymmetric signing — visibly different from a Blink token); confirmed
the app functioned completely normally on that Supabase-authenticated
path (My Collection rendered real inventory data); signed out and
confirmed **both** `blink_tokens_...` and `pocketpull-supabase-auth`
localStorage keys were cleared; logged in as a deliberately-unlinked
second test account and confirmed zero Supabase session was attempted
or created, and the app worked identically to before this phase
existed.

At the end of Phase 4: this is the current state of the codebase. See
Section 6 for exactly what's live where.

---

## 6. What is currently live in production

**All 7 PRs are merged to `main`** and deployed to production as of
this writing (confirmed via `git pull origin main` — fast-forwarded
cleanly, no divergence):

| PR | Title |
|----|-------|
| [#27](https://github.com/ItsRedXO/pocketpull-website/pull/27) | Phase 1: parallel Supabase Auth verification |
| [#28](https://github.com/ItsRedXO/pocketpull-website/pull/28) | Phase 2: accept Supabase JWTs as an additional auth path |
| [#29](https://github.com/ItsRedXO/pocketpull-website/pull/29) | Fix full-project typecheck (unrelated) |
| [#30](https://github.com/ItsRedXO/pocketpull-website/pull/30) | Phase 3: silent migration on next login |
| [#31](https://github.com/ItsRedXO/pocketpull-website/pull/31) | Fix username login (unrelated) |
| [#32](https://github.com/ItsRedXO/pocketpull-website/pull/32) | Fix orphaned user rows on signup (unrelated) |
| [#33](https://github.com/ItsRedXO/pocketpull-website/pull/33) | Phase 4: prefer live Supabase session |

**Railway project**, one service, two environments:

| Environment | Branch | Domain | Notes |
|---|---|---|---|
| `production` | `main` | `pocketpull-website-production.up.railway.app` + the live custom domain | Auto-deploys on every push to `main` |
| `staging` | `staging` | `pocketpull-website-staging.up.railway.app` | Auto-deploys on every push to `staging`. **Shares production's database** — see the warning at the top of this document. Used throughout this migration purely as a place to deploy-and-click-test before merging to `main`, not as a data sandbox. |

**Environment variables, by environment** (names only; values are
secrets and are not reproduced here):

`production` currently has:
`BLINK_PROJECT_ID`, `BLINK_SECRET_KEY`, `BLINK_SERVER_SEED`,
`COINBASE_API_KEY`, `COINBASE_WEBHOOK_SECRET`, `DATABASE_URL`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_SUPABASE_ANON_KEY`,
`VITE_SUPABASE_URL`.

`staging` currently has all of the above **plus**: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VITE_BACKEND_URL` (added mid-migration —
staging's frontend was found to be calling production's backend by
default until this was set).

**This asymmetry is important and is called out again in Section 8 as
a known issue**: production is missing the plain (non-`VITE_`,
backend-only) `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
Production has the two `VITE_` (frontend-public) Supabase vars, which
is what let Phase 4 be activated and verified there, but the
**backend's own** Supabase verification path (`resolveUserId` in
`backend/lib/auth.ts`, and `/auth/silent-migrate`) cannot function on
production without `SUPABASE_URL`, and `/auth/silent-migrate`
additionally needs `SUPABASE_SERVICE_ROLE_KEY`.

**Database state** (confirmed via direct Supabase SQL query,
2026-09-07): `auth.users` (the Supabase side) contains exactly 2 rows —
the pilot (`73b591e1-0034-422b-b367-e270816786d7`,
`lopezdavid689@yahoo.com`, created 2026-09-06 09:38:18) and one
throwaway test account (`327ddf98-ad04-4448-be47-a1481dd19863`,
`claude-phase3-verify-9182c9@example.com`, created 2026-09-07
22:36:09 — see Section 8c). No direct query access to the
Railway/app-side `public.users` table was available during this work
(no Postgres credentials for `DATABASE_URL` were ever exposed to this
session, by design), so the exact `auth_user_id IS NOT NULL` count in
`public.users` was not directly queried — but per the idempotency test
in Section 4, at least these same 2 accounts are confirmed linked
there.

---

## 7. What was tested — staging and production results

**PR #29 (typecheck fix)**: staging deploy — health check 200, full
homepage render, login/signup modals both render and function, console
errors traced and confirmed pre-existing/unrelated (a recurring
"column data does not exist" 500 — see Section 8 — and expected 401s
for anonymous requests). Then merged to `main`; production deploy
verified the same way, plus confirmed production's *previous* active
deployment predated all of this work (0 issues before touching it).

**PR #28 (Phase 2)**: full line-by-line diff review before merge
(described in Section 3). Backend test suite run: 30/33 pass; all 3
failures independently confirmed pre-existing and identical on `main`
(a missing `vitest` dependency, and two stale regex assertions against
frontend source text unrelated to auth) via an isolated `git worktree`
comparison. Staging: health check, `/auth/whoami-supabase` and
`/referrals` and `/admin/stats` all correctly reject missing/garbage
tokens (401), confirming the dual-path resolver fails closed. Merged;
same checks repeated against production after merge.

**PR #30/#31/#32 (Phase 3 + the two unrelated fixes)**: staging
end-to-end browser testing across many iterations (see Section 4 for
the full happy-path/idempotency result). Discovered mid-testing that
staging and production share one database (Section header warning).
Root-caused the orphaned-row bug via **temporary diagnostic logging**
deployed straight to the `staging` branch outside the PR workflow
(explicitly a throwaway debugging technique, `git revert`ed
immediately after use — not part of any merged PR's final diff).

**PR #33 (Phase 4)**: staging end-to-end verification exactly as
described in Section 5 (session establishment, correct token sent,
sign-out clears both sessions, unlinked account unaffected). Also
caught and fixed the Dockerfile build-arg gap during this testing,
before it ever reached `main`.

**Merge mechanics note**: several of these PRs' branches were created
before an earlier PR in the sequence was merged, so merging them in
order produced real (not spurious) git conflicts in
`src/hooks/useAuth.ts` more than once. Each was resolved by hand,
re-typechecked (`tsc --noEmit`), re-built (`npm run build`), and
re-pushed before retrying the GitHub merge — every one of these merges
is clean in the final `main` history.

**A note on tooling**: this session's automated safety classifier
blocked several of the `PUT .../pulls/{n}/merge` API calls on the
first attempt (apparently a rate/caution mechanism after consecutive
production-affecting merges). Every one of these was resolved by
explicitly asking the user for confirmation before retrying — none
were worked around silently. If you hit the same block, do the same:
stop and ask, don't retry blindly.

---

## 8. Known issues

### 8a. ACTIVE / production-affecting: backend Supabase env vars missing on production

Discovered while writing this document (2026-09-07), **not yet fixed**.
Production has `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (frontend,
public) but is **missing** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
(backend-only). Consequence: if any production account's browser
establishes a live Supabase session (Phase 4) and `getPreferredAuthToken()`
starts sending a Supabase token instead of a Blink one, the **backend
cannot verify it** — `verifySupabaseToken` throws immediately because
`SUPABASE_URL` is unset, `resolveUserId` falls through to `null`
(Blink verification also fails, since the token isn't a Blink token),
and the request comes back `401 UNAUTHORIZED` — even though the same
account has a perfectly valid Blink session sitting unused.

This is currently **latent, not confirmed-active**: it only triggers
once a production account both (a) has `auth_user_id` linked and (b)
has logged in since Phase 4's production activation moments ago. As of
writing, the only production account meeting (a) is the pilot
(`usr_YZHIwRCxVfoM`), and it is not yet confirmed whether they have
logged in again since. **This should be treated as urgent** — the fix
is adding the same two variables already present on `staging` to
`production` and letting it redeploy. Not applied in this session per
explicit instruction to make documentation-only changes.

### 8b. Recurring, unresolved: `"column \"data\" does not exist"` 500

Seen intermittently, throughout this entire session, on `POST /db`
requests, on both `staging` and `production`, across many different
and seemingly unrelated features (the homepage recent-pulls/live
ticker, and others observed but not individually isolated). Confirmed
**not** related to the orphaned-row bug (8c below) — that was
root-caused separately and is a different error
(`invalid input syntax for type integer`, code `22P02`) on a different
code path (`backend/routes/userDbProxy.ts`'s `create` operation). This
one was never root-caused; it was actively chased as a hypothesis for
the orphaned-row bug and turned out to be a red herring for that
specific investigation.

Leading hypothesis, unconfirmed: the generic ORM-style DB proxy helpers
backing `blink.db.table(...)`-style calls (`backend/routes/dbProxy.ts`,
`userDbProxy.ts`, `supportDbProxy.ts`) may assume every table has a
catch-all `data` JSONB column, and error when it hits a table that
doesn't have one. Not confirmed. To reproduce: browse the live site as
an anonymous visitor for ~30 seconds with browser dev tools open on the
Network tab, filter for `/db`, watch for intermittent 500s (roughly 1
in every 10-20 requests in observed sessions), inspect the response
body.

### 8c. Fixed, but worth knowing about: orphaned rows on signup

**Fixed** in [PR #32](https://github.com/ItsRedXO/pocketpull-website/pull/32) — documented here because it directly blocked
Phase 3/4 testing and a future reader will otherwise wonder why test
accounts behaved strangely mid-migration.

Root cause: `src/hooks/useAuth.ts`'s `useUserStats` lazily creates a
user's Postgres row on first load if one doesn't exist, and previously
sent `isBanned: false, isDeleted: false, referralRewardPaid: false`.
Those are **integer** (`0`/`1`) columns in Postgres — the same
convention already used one field over (`emailVerified: 1`) and by
every other `users.update()` call in the admin panel. `node-postgres`
serializes a JS boolean as the literal text `"true"`/`"false"`, which
Postgres rejects for an integer column (`invalid input syntax for type
integer: "false"`, code `22P02`). Every brand-new signup hit this on
first load; the frontend's `.catch()` only tolerated HTTP 409, this was
a 500, so the row was never created — the account could still log in
via Blink, but had no Postgres row at all, breaking balance/profile
display and blocking anything keyed on that row (including Phase 3's
own lookup). Fix was one line (now live in `useAuth.ts`, see the
`isBanned: 0, isDeleted: 0, ..., referralRewardPaid: 0` call in
`useUserStats`'s `queryFn`, with a comment explaining why).

**Side effect of testing this**: several throwaway test accounts now
exist in the live (shared staging/production) database:
`ClaudePhase3Test` / `usr_CC7fzQXN5240` (linked to a real Supabase
identity), `ClaudePhase3Test2` / `usr_GU2wXUsyFSeH` (not linked, used
to verify unlinked accounts are unaffected), plus their corresponding
`auth.users` rows where applicable. These are harmless junk but real
rows — consider cleaning them up.

### 8d. Design limitation, not a bug: session only refreshed at explicit login

`establishSupabaseSession` (Phase 4) only runs inside `useAuth.signIn`
— i.e., only on an explicit login action. A user whose Blink session
persists across visits (the common case — Blink sessions survive page
reloads) may go a long time without ever triggering it, even after
becoming eligible. This is consistent with Phase 3's own trigger point
(also "next login") and was an accepted, understood tradeoff of the
"gradual, opportunistic" design — not something to fix reflexively,
but worth knowing if adoption seems slower than expected.

### 8e. Design limitation, not a bug: no fallback-on-expiry within a single request

`getPreferredAuthToken()` sends the Supabase token whenever a session
object exists locally, without pre-validating it's still fresh. If a
Supabase session's access token were ever stale (refresh failed
silently, clock skew, brief Supabase outage) while Blink's own token is
still perfectly valid, that single request would fail rather than
falling back. Assessed as low-risk (Supabase's SDK auto-refreshes
proactively) and consistent with this migration's established
best-effort philosophy, but not defended against.

---

## 9. What is NOT finished

- **Backend Supabase env vars on production** (Section 8a) — not set.
  This is the most urgent gap; see Section 10.
- **The `data`-column 500** (Section 8b) — not root-caused, not fixed.
- **Real user coverage is essentially zero.** Only 2 accounts total
  have a linked Supabase identity (1 real, 1 test). 69-70 of the 71
  real users have never logged in since Phase 3 shipped and remain
  Blink-only. Phase 3/4's whole design assumes this grows gradually
  over time as people log in normally — nothing forces it, and nobody
  is currently monitoring or reporting on that growth rate.
- **No live/production traffic actually depends on Supabase yet.**
  Every real user today is still authenticating and being served via
  Blink for every request. Supabase is fully wired and proven to work,
  but is not yet load-bearing for anyone except the pilot (and even the
  pilot may be hitting 8a right now, unconfirmed).
- **Blink has not been touched, reduced, or scheduled for removal.**
  `BLINK_PROJECT_ID`/`BLINK_SECRET_KEY` and all Blink SDK usage remain
  fully in place, per the standing hard constraint. No phase of this
  work has even begun planning Blink's eventual removal.
- **Realtime features are entirely untouched.** `blink.realtime.subscribe(...)`
  (used by pack battles, support chat, inventory-update notifications)
  was never evaluated for a Supabase equivalent. If Blink is ever
  actually removed, this is a separate, unstarted piece of work.
- **Password reset is still Blink-only.** `sendPasswordReset` calls
  `blink.auth.sendPasswordResetEmail` only. If a linked user resets
  their Blink password, their Supabase identity's password silently
  falls out of sync (no error, no disruption — Blink still works fine
  as the fallback — but that account's Supabase session will quietly
  stop being obtainable until some future re-sync mechanism exists).
  Not designed or built.
- **Admin panel login** (`src/admin/useAdminAuth.ts`) was explicitly
  left untouched in Phase 4 as out-of-scope (staff-only, separate flow).
  It passively benefits from `blink.ts`'s shared token-preference logic
  if an admin has *also* logged into the main site and gotten linked,
  but has no `establishSupabaseSession`-equivalent of its own.
- **No bulk backfill mechanism exists** for the 70 unmigrated users
  beyond "wait for them to log in." No decision has been made about
  whether one should ever be built for stragglers.
- **Test/junk data cleanup** (Section 8c) — not done.

---

## 10. Exact next recommended step

**Do not start this yet — the user has asked for documentation only in
this pass.**

The single highest-priority action, ahead of any new feature work, is:

1. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the
   `production` environment on Railway (same values already present on
   `staging` — `SUPABASE_URL` is public and safe to copy directly;
   `SUPABASE_SERVICE_ROLE_KEY` is a real secret and should be re-copied
   carefully, not guessed or regenerated). This one change closes the
   gap described in Section 8a and makes the backend's Supabase
   verification path (and `/auth/silent-migrate`) actually functional
   in production, matching what's already proven to work on staging.
2. Immediately after, verify: log in as the pilot account (or any
   linked account) on production and confirm requests succeed
   normally — specifically confirm this does **not** produce 401s once
   a Supabase session is established client-side, since that's exactly
   the failure mode 8a describes.
3. Only after that is confirmed safe, the natural following steps (in
   rough priority order, none started, none scoped in detail yet) are:
   root-causing the `data`-column 500 (8b), cleaning up test/junk
   accounts (8c), and eventually deciding whether/when to build
   anything for the ~69 real users who may take a long time to
   naturally log in and get linked otherwise.

Do not begin a "Phase 5", do not remove any Blink code, and do not
treat "Phase 4 is merged" as "the migration is done" — real-user
coverage is effectively at the starting line.
