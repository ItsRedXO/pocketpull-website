# PocketPull Blink-to-PostgreSQL Migration Design

**Status:** Approved by project owner on 2026-08-31

## Goal

Move PocketPull from Blink-hosted authentication, database, backend runtime, and realtime dependencies to an independently hosted production stack while preserving existing user identities, balances, inventory, transaction history, battles, cashouts, and provably-fair audit history.

## Constraints

- The current Blink production project remains untouched until the replacement is fully tested.
- The existing GitHub `main` branch remains the production-code baseline; migration work stays on `migration/postgres-foundation` until reviewed.
- Existing PocketPull user IDs must be preserved.
- Existing email addresses must be preserved.
- Existing password hashes must be preserved only if Blink exports them in a form that can be safely imported; plaintext passwords must never be exported or stored by the migration tooling.
- Financial and provably-fair history is immutable after migration.
- Stripe and Coinbase integrations remain functional and continue to use server-side secrets only.
- The browser must not receive database credentials, payment secrets, Blink secrets, or server seeds.
- Wallet balance changes must become atomic PostgreSQL transactions with an auditable ledger.
- Provably-fair seed/nonce/odds history must remain independently verifiable after migration.
- No production DNS cutover occurs until functional, concurrency, payment, authentication, and PF verification tests pass.

## Target Architecture

React/Vite frontend communicates with a Hono/TypeScript backend. The backend owns PostgreSQL access, authentication, wallet mutations, payments, inventory, packs, battles, cashouts, support, and provably-fair records. Stripe and Coinbase remain external payment providers. Realtime functionality is replaced with a provider or server mechanism that does not require Blink.

## Data Domains

The migration must account for the exported business-data tables/entities including users, transactions, wallet transactions, inventory, packs catalog, pack cards, pack cooldowns, server seeds, user nonces, pack odds versions, packs opened, upgrader spins, battles, battle players, battle results, battle pull audits, leaderboard stats, cashout requests, activity logs, support chats, support messages, outbound email history, notifications, admin users, admin credentials/settings, and any additional tables present in the authoritative CSV export.

Empty exported tables do not require row migration, but their target schema must still be created when application code depends on them.

## Authentication Strategy

Existing account IDs remain stable. The migration first determines whether the Blink export contains compatible password hashes. If compatible hashes are available, import them into the new authentication system without rehashing or exposing them. If they are unavailable or incompatible, use a controlled account-migration/reset flow that preserves the existing user record and all business data while requiring a secure password reset. Sessions/tokens are never migrated as permanent credentials.

## Wallet Strategy

Replace the current Blink read-modify-write wallet operation with a PostgreSQL transaction that locks the user row, validates available balance, updates real and matched balances atomically, inserts a unique ledger record, and commits as one unit. Payment webhooks must be idempotent on provider transaction identifiers. Inventory sale/open/battle/upgrader mutations must not be able to create money without a corresponding committed ledger event.

## Provably Fair Strategy

Preserve server seed hashes and seed lifecycle records, user nonces, odds-version snapshots/hashes, pack-open records, upgrader-spin records, and battle pull audits. The server seed secret remains an environment secret and is never stored in GitHub or sent to the client. The new implementation must reproduce historical verification results before cutover.

## Migration Safety

Perform the migration as a shadow/parallel deployment. Export and validate data, import into a non-production PostgreSQL database, run integrity checks, run application tests against the new backend, perform a final read-only/freeze window for the final data sync, verify row counts and financial totals, then cut over DNS/application traffic. Keep Blink available until post-cutover verification succeeds and a rollback window has passed.
