# PostgreSQL migration status

The `postgres-migration` branch now contains the PostgreSQL foundation, schema, migration runner, import/validation tooling, user/transaction/wallet repositories, inventory repository, pack/PF/battle/upgrader/exchanger/cashout/log repositories, and PostgreSQL-backed auth user checks and referral/stat paths.

## Required before cutover

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm run db:migrate`.
3. Export the existing Blink application data into the documented JSON format.
4. Run the importer with `--dry-run`, then import and run `npm run db:validate`.
5. Finish converting the remaining route modules (pack opening, battles, upgrader, exchanger, cashout, logs, Stripe/Coinbase) so their actual reads/writes use the repositories. Existing frontend behavior is intentionally unchanged.

No production database is contacted by these repository changes and no Blink data is deleted.
