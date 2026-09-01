# PocketPull database export counts

Updated from the local CSV audit on 2026-08-31.

## Verified expanded exports

| Table | Rows |
|---|---:|
| users | 76 |
| wallet_transactions | 4,262 |
| transactions | 7,428 |
| packs_opened | 5,963 |
| inventory | 1,031 |
| battles | 304 |
| battle_pull_audits | 2,097 |
| battle_players | 642 |
| activity_logs | 6,164 |

## Existing exports at or below the 200-row page size

These did not require manual pagination based on the user's export workflow: admin_credentials (50), admin_users (1), battle_results (50), cashout_requests (3), email_verification_tokens (31), leaderboard_stats (50), pack_cooldowns (50), packs_catalog (23), server_seeds (7), support_chats (10), support_messages (50), upgrader_multiplier_settings (11), upgrader_spins (50), user_nonces (43), password_reset_tokens (1), and _blink_auth (1).

`magic_link_tokens`, `notifications`, `outbound_emails`, `pack_odds_versions`, and `user_settings` were reported empty in Blink and therefore had no rows to export.

## Important export note

The original 50-row files were page-limited exports, not authoritative table counts. The expanded counts above come from combining every exported page for those tables.

Do not treat the counts of the remaining <=200-row tables as proof that Blink contains no additional rows unless the export UI is confirmed to export the complete table when set to 200 rows.

## Migration safety

- Never commit raw CSV exports containing user or financial data to Git.
- Preserve existing IDs during migration.
- Preserve immutable financial and provably-fair audit history.
- Do not modify production or the `main` branch as part of migration development.
