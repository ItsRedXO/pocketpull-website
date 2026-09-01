# PocketPull PostgreSQL Application Data Migration Design

**Date:** 2026-09-01

## Goal

Move PocketPull application data off Blink DB onto provider-agnostic PostgreSQL while preserving existing user-facing behavior, admin workflows, provably-fair guarantees, wallet correctness, and production safety.

## Architecture

PostgreSQL is the sole application database. The backend owns all database access through a small PostgreSQL adapter and HTTP APIs; the frontend never accesses application tables directly. `DATABASE_URL` is preferred when present, with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` supported as provider-neutral configuration.

Blink may remain temporarily for authentication token verification and notification/storage capabilities that are not part of the application database migration, but no business-data CRUD may delegate to Blink DB.

## Data integrity requirements

1. Wallet mutations must be atomic and concurrency-safe.
2. Pack opens must remain provably fair and persist nonce/audit data.
3. Inventory ownership must be durable before a successful pack-open response.
4. Mystery-pack card quantities must be claimed atomically.
5. Admin pack/card CRUD must use PostgreSQL.
6. Frontend catalog, inventory, upgrader, exchanger, battles, profile, referrals, and activity reads must use backend APIs backed by PostgreSQL.
7. Production must not be modified as part of migration development.
8. Existing UI behavior and routes should remain compatible unless a backend boundary requires an equivalent API call.

## Migration boundary

The migration covers application tables and all reads/writes to them. External payment providers, authentication issuer integration, email notification delivery, and object storage are not replaced unless required to remove a Blink database dependency.

## Success criteria

- Repository contains no direct frontend `blink.db` application-data access.
- Backend application-data access resolves through PostgreSQL only.
- Schema migrations are idempotent and safe to run on an empty migration database.
- Automated backend tests cover critical wallet, pack-open, mystery inventory, and admin CRUD invariants.
- Typecheck/build/lint and backend tests pass before merge.
- A staging PostgreSQL database can run the full application without production data or production secrets.
