# PocketPull PostgreSQL Migration Plan

Status: planning / schema discovery only. No production cutover is implied.

## Goals

- Remove PocketPull's runtime dependency on Blink for application data, authentication, backend execution, and realtime features.
- Preserve existing user IDs, inventory IDs, transaction history, pack definitions, battles, cashouts, and provably-fair audit history where the source data permits.
- Make wallet mutations atomic and auditable in PostgreSQL.
- Keep the current Blink-backed site untouched while the replacement stack is developed and tested.

## Source of truth

The exported PocketPull source code is the current application reference. The live Blink database CSV exports are the authoritative source for existing rows and actual column values.

## Core migration domains

### Identity and access
- users / Blink auth profile data
- admin users
- admin credentials: replace legacy secret-based authorization with proper server-side authorization
- email verification tokens
- password reset tokens
- magic link tokens

Temporary authentication tokens should not be migrated as reusable sessions. Existing users will need a controlled authentication migration/reset strategy because password plaintext is not expected to be exportable.

### Economy
- transactions
- wallet transaction ledger
- user balances / matched balances
- referral and bonus state
- cashout requests

Wallet mutations must use database transactions/row locking or equivalent atomic operations. The ledger is the audit trail; mutable balances are derived/maintained state.

### Packs and inventory
- packs_catalog
- pack_cards
- pack_cooldowns
- inventory
- packs_opened
- pack_odds_versions

Pack/card IDs and historical opening records should be preserved where possible.

### Provably Fair
- server_seeds
- user_nonces
- pack_odds_versions
- packs_opened
- upgrader_spins
- battle_pull_audits

Historical records must remain verifiable after migration. Do not regenerate or rewrite historical seeds, nonces, rolls, or audit records.

### Battles
- battles
- battle_players
- battle_results
- battle_pull_audits

Preserve historical battle identifiers and player relationships.

### Admin / support / operational data
- activity_logs
- leaderboard_stats
- support_chats
- support_messages
- outbound_emails
- notifications
- upgrader_multiplier_settings

Empty source tables can be recreated without data; temporary token tables can be recreated for the new auth system.

## Migration sequence

1. Inventory actual CSV files and column names.
2. Compare CSV columns against all Blink DB usages in the source code.
3. Resolve type/nullability/ID ambiguities before writing production schema.
4. Create PostgreSQL schema and indexes on an isolated migration branch/environment.
5. Create deterministic CSV import scripts with validation and row-count checks.
6. Build a compatibility data-access layer.
7. Migrate backend routes domain-by-domain.
8. Replace frontend direct Blink database/realtime calls with the PocketPull API.
9. Add new authentication flow and account migration handling.
10. Run parallel verification against a non-production copy.
11. Perform a final source-data sync and reconciliation.
12. Cut over only after wallet, inventory, payments, PF, battles, cashouts, and admin checks pass.

## Hard safety rules

- Never commit secrets, API keys, payment credentials, or authentication tokens to Git.
- Never overwrite the production Blink database during migration work.
- Never alter historical provably-fair audit records to fit a new schema.
- Never perform wallet balance migrations without reconciliation against the transaction ledger.
- Never delete the Blink project until the replacement system has been validated and a rollback path exists.

## Current blocker

The uploaded database ZIP contains the live CSV exports, but the development environment may require the CSVs to be uploaded/exposed individually before they can be programmatically inspected. Do not infer live column definitions when the authoritative CSV is available.
