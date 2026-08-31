# PocketPull database export inventory

## Source

The current Blink database was exported as CSVs on 2026-08-31 and inspected locally using a non-content inventory report. The report captures table names, observed exported row counts, and column names.

**Important:** many tables show exactly 50 rows. This may reflect the export/page limit rather than the true table cardinality. These counts are therefore **not authoritative** until the raw exports are validated.

## Tables observed

| Table | Observed rows | Columns observed |
|---|---:|---|
| `_blink_auth` | 1 | `id`, `adopted_users`, `created_at` |
| `activity_logs` | 0 | `id`, `type`, `user_id`, `username`, `action`, `details`, `value_in`, `value_out`, `result`, `metadata`, `created_at` |
| `admin_credentials` | 50 | `id`, `username`, `admin_pass`, `created_at`, `email` |
| `admin_users` | 0 | `id`, `username`, `password_hash`, `created_at` |
| `battle_players` | 50 | `id`, `battle_id`, `user_id`, `username`, `avatar`, `is_ai`, `joined_at`, `cards_json`, `total_value`, `is_winner`, `team_side` |
| `battle_pull_audits` | 50 | `id`, `battle_id`, `battle_player_id`, `user_id`, `pack_id`, `pack_name`, `card_name`, `rarity`, `cost`, `client_seed`, `nonce`, `roll_value`, `server_seed_hash`, `odds_version_hash`, `is_bot`, `created_at` |
| `battle_results` | 50 | `id`, `battle_id`, `winner_user_id`, `winner_username`, `total_pot`, `mode`, `ended_at` |
| `battles` | 50 | `id`, `host_user_id`, `host_username`, `host_avatar`, `mode`, `player_count`, `is_public`, `status`, `packs_json`, `total_cost`, `private_code`, `created_at`, `started_at`, `ended_at`, `winner_user_id`, plus additional exported fields to verify from raw CSV |
| `cashout_requests` | 3 | `id`, `user_id`, `username`, `confirmation_number`, `status`, `total_value`, `total_cards`, `cards_json`, `shipping_name`, `shipping_address`, `shipping_city`, `shipping_state`, `shipping_zip`, plus additional exported fields to verify from raw CSV |
| `email_verification_tokens` | 31 | `id`, `user_id`, `token_hash`, `lookup_hash`, `expires_at`, `created_at` |
| `inventory` | 50 | `id`, `user_id`, `card_id`, `card_name`, `rarity`, `value`, `emoji`, `is_favorite`, `created_at`, `card_image_url`, `pack_name`, `is_locked`, `battle_id` |
| `leaderboard_stats` | 50 | `id`, `username`, `biggest_pull`, `packs_opened`, `xp_gained`, `win_streak`, `updated_at`, `is_deleted`, `upgrades_attempted` |
| `pack_cards` | 50 | `id`, `pack_id`, `card_name`, `rarity`, `pull_chance`, `estimated_value`, `card_image_url`, `sort_order`, `quantity`, `original_quantity` |
| `pack_cooldowns` | 50 | `id`, `user_id`, `pack_id`, `last_opened_at` |
| `packs_catalog` | 23 | `id`, `name`, `price`, `description`, `image_url`, `glow_color`, `border_color`, `is_active`, `sort_order`, `created_at`, `quantity_limit`, `current_quantity`, `cooldown_hours`, `expires_at`, `name_color`, `description_color`, plus additional exported fields to verify from raw CSV |
| `packs_opened` | 50 | `id`, `user_id`, `pack_id`, `pack_name`, `cost`, `created_at`, `card_name`, `rarity`, `client_seed`, `nonce`, `roll_value`, `odds_version_hash`, `server_seed_hash`, `provably_fair` |
| `password_reset_tokens` | 0 | `id`, `user_id`, `token_hash`, `lookup_hash`, `expires_at`, `created_at` |
| `server_seeds` | 7 | `id`, `seed_hash`, `period_start`, `period_end`, `revealed_seed`, `revealed_at`, `created_at`, `status` |
| `support_chats` | 6 | `id`, `user_id`, `username`, `status`, `subject`, `last_message`, `last_message_at`, `created_at`, `updated_at` |
| `support_messages` | 50 | `id`, `chat_id`, `user_id`, `sender_type`, `message`, `created_at` |
| `transactions` | 50 | `id`, `user_id`, `type`, `amount`, `description`, `created_at` |
| `upgrader_multiplier_settings` | 11 | `multiplier`, `max_chance` |
| `upgrader_spins` | 50 | `id`, `user_id`, `multiplier`, `total_input_value`, `balance_used`, `baseline_target_value`, `total_target_value`, `win_chance`, `is_win`, `client_seed`, `nonce`, `roll_value`, `server_seed_hash`, `odds_version_hash`, plus additional exported fields to verify from raw CSV |
| `user_nonces` | 43 | `user_id`, `pack_nonce`, `upgrade_nonce` |
| `users` | 50 | `id`, `email`, `display_name`, `username`, `avatar_url`, `xp`, `level`, `balance`, `email_verified`, `role`, `metadata`, `created_at`, `updated_at`, `last_sign_in`, `password_hash`, `phone`, `phone_verified`, `is_banned`, plus additional exported fields to verify from raw CSV |
| `wallet_transactions` | 50 | `id`, `user_id`, `type`, `amount`, `balance_before`, `balance_after`, `matched_before`, `matched_after`, `source_id`, `metadata`, `created_at` |

## Migration safety notes

1. Local CSV exports must never be committed to Git. The migration branch ignores `/database/*.csv` and `/database/*.zip`.
2. Authentication token tables (`password_reset_tokens`, `email_verification_tokens`, `magic_link_tokens`) contain secrets/tokens and should not be treated as ordinary business history.
3. `admin_credentials.admin_pass` is sensitive and requires special handling. It must not be copied into a public repository or logged.
4. Existing user IDs must remain stable so inventory, wallet, battle, payment, and audit relationships remain intact.
5. Wallet transaction history and provably-fair audit records are financial/security-critical and should be migrated without rewriting historical values.
6. The observed 50-row values must not be interpreted as complete table counts until the raw CSV export behavior is confirmed.

## Next validation

Before writing the production PostgreSQL schema, validate the raw CSV headers and complete row counts, then map foreign-key relationships and sensitive fields. Authentication compatibility must be verified before any production cutover.
