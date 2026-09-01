# PocketPull PostgreSQL Migration — Live Status

Branch: `migration/postgres-foundation`

This is the authoritative progress board.

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
- [x] Frontend auth/profile/balance data reads moved behind PostgreSQL API
- [x] Frontend pack/card/catalog reads moved behind PostgreSQL API
- [x] Frontend support persistence moved behind PostgreSQL API
- [x] Frontend leaderboard/live stats moved behind PostgreSQL API
- [x] PostgreSQL compatibility layer added so remaining legacy `blink.db.*` calls resolve to PostgreSQL instead of Blink DB
- [x] Admin-panel database operations are covered by the PostgreSQL compatibility layer
- [x] Standalone Hono Node server added
- [x] Vite `/api` development proxy added
- [x] Backend TypeScript project added
- [x] Full migration implementation plan committed
- [x] Live migration status board committed
- [x] Branch verification workflow committed

## Remaining verification / cleanup

- [ ] Replace any remaining absolute `*.backend.blink.new` API URLs with `VITE_API_BASE_URL` / `/api`.
- [ ] Add focused tests for payments, cashout, referrals, support, public catalog, and compatibility-layer operations.
- [ ] Add a migration audit script that fails on production-path Blink DB access and checks the compatibility boundary.
- [ ] Verify the standalone backend runtime against the actual deployment environment.
- [ ] Run full frontend TypeScript checks and the full Vitest suite.
- [ ] Run the production build after the migration changes.
- [ ] Verify the complete branch is clean and only contains intended migration commits.

## Deferred by design

- [ ] Replace Blink JWT authentication with PostgreSQL-backed authentication. Blink remains only the external identity/token provider for this migration.
- [ ] Replace Blink realtime transport with a PostgreSQL-backed realtime transport. Realtime currently carries events only; application state is persisted in PostgreSQL.

## Current architectural rule

**Blink is no longer the application database.** Remaining Blink usage is restricted to identity/token verification, realtime transport, or external notification delivery. Application state is PostgreSQL-authoritative.
