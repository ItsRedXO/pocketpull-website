# PocketPull PostgreSQL Migration — Live Status

Branch: `migration/postgres-foundation`

This file is the authoritative progress board. It is updated as migration work lands.

## Completed

- [x] PostgreSQL pool/configuration and schema foundation
- [x] Wallet repository + wallet tests
- [x] PostgreSQL pack-opening route is authoritative
- [x] Pack-opening nonce / odds snapshot / provably-fair settlement path
- [x] Pack-opening cooldown race protection
- [x] Inventory lock/favorite/sell/sell-all backend path
- [x] Exchanger PostgreSQL backend path
- [x] Upgrader PostgreSQL backend path
- [x] Battle lobby/create/join/state PostgreSQL path
- [x] Battle execution PostgreSQL path selected as authoritative route
- [x] Battle admin cancellation moved to PostgreSQL
- [x] Stripe persistence moved to PostgreSQL
- [x] Coinbase persistence moved to PostgreSQL
- [x] First-deposit bonus persistence moved to PostgreSQL
- [x] Referral reward persistence moved to PostgreSQL
- [x] Referral listing moved to PostgreSQL
- [x] Cashout submission moved to PostgreSQL transaction
- [x] Cashout admin fulfillment moved to PostgreSQL transaction
- [x] Activity logs moved to PostgreSQL
- [x] Outbound email audit moved to PostgreSQL
- [x] User bootstrap/profile API added
- [x] Frontend auth/profile/balance data reads removed from direct Blink DB access
- [x] Frontend pack catalog/card/cooldown/recent-pull/hall-of-fame/god-pull reads moved to API
- [x] Frontend support chat persistence moved to API/PostgreSQL
- [x] Frontend leaderboard database reads moved to API/PostgreSQL
- [x] Frontend live battle stats moved to API/PostgreSQL
- [x] Standalone Hono Node server added
- [x] Vite `/api` development proxy added
- [x] Backend TypeScript project added
- [x] Migration implementation plan committed

## Remaining

### High priority

- [ ] Migrate remaining admin-panel direct Blink DB reads/writes (Packs, Users, Pulls, Stats, Cashouts, Logs, Emails, Provably Fair, etc.) to PostgreSQL APIs.
- [ ] Audit remaining frontend source for direct `blink.db.*` calls and remove them.
- [ ] Replace any remaining absolute `*.backend.blink.new` API URLs with `VITE_API_BASE_URL` / `/api`.
- [ ] Add focused tests for payments, cashout, referrals, support, and public catalog routes.
- [ ] Add migration audit script that fails on production-path Blink DB access.
- [ ] Verify the backend runtime against the actual deployment environment.
- [ ] Run full frontend/backend TypeScript checks and full Vitest suite.
- [ ] Run production build after all migration changes.

### Deferred by design

- [ ] Replace Blink JWT authentication with PostgreSQL-backed authentication. The current migration intentionally retains Blink only as an external identity/token provider while application data is PostgreSQL-authoritative.
- [ ] Replace Blink realtime transport with a PostgreSQL-backed/realtime transport. Current realtime use is transport-only and does not persist application data.

## Current architectural rule

**Blink is no longer an application database.** Any remaining Blink usage must be limited to identity/token verification, realtime transport, or external notification functionality. Application state belongs in PostgreSQL.
