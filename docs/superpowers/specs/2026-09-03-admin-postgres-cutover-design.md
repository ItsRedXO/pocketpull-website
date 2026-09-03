# Admin PostgreSQL Cutover Design

## Goal
Move the Admin Panel's browser database traffic and admin logging fully onto the Railway/PostgreSQL backend so admin reads and mutations operate on the same production data as the main site.

## Scope
- Preserve the existing Admin Panel UI and dedicated admin login.
- Route browser DB calls through the Railway PostgreSQL proxy, including dedicated admin-session authentication.
- Add missing database operations required by the existing UI (`count`, `upsert`) and correct support-table column mappings.
- Keep normal-user authorization scoped to the authenticated user while allowing the dedicated admin session to perform admin operations.
- Move admin log writes/reads to Railway/PostgreSQL and remove production dependencies on the legacy Blink API for Admin Panel functionality.
- Add regression coverage for admin-session headers, count/upsert proxy contracts, and critical admin balance mutation behavior.

## Non-goals
- Rebuild the Admin Panel UI.
- Remove Blink authentication immediately; it remains the authentication provider during this migration.
- Change business rules for balances, cashouts, packs, or user management.

## Success Criteria
1. Admin Panel loads users, packs/cards, support chats, cashouts, logs, and other sections from PostgreSQL.
2. Admin balance add/set updates the PostgreSQL `users` row and remains visible after refresh.
3. Cashout counts/listing work without `count()` runtime failures.
4. Support chat reads/writes use real PostgreSQL columns.
5. Admin logging no longer sends production requests to the legacy Blink backend.
6. Existing non-admin user DB access remains restricted.
7. CI typecheck, regression tests, frontend build, backend health smoke test, and Docker build pass.
