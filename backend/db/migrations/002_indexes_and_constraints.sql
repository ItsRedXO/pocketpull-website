CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_id_unique ON transactions(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users(referred_by_id);
CREATE INDEX IF NOT EXISTS inventory_user_idx ON inventory(user_id, sold, locked);
CREATE INDEX IF NOT EXISTS inventory_card_idx ON inventory(card_id);
CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS packs_opened_user_created_idx ON packs_opened(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS packs_opened_pack_idx ON packs_opened(pack_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pack_cards_pack_idx ON pack_cards(pack_id);
CREATE INDEX IF NOT EXISTS battles_status_public_idx ON battles(status, is_public);
CREATE INDEX IF NOT EXISTS battle_participants_battle_idx ON battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS battle_results_battle_idx ON battle_results(battle_id);
CREATE INDEX IF NOT EXISTS battle_audits_battle_idx ON battle_pull_audits(battle_id);
CREATE INDEX IF NOT EXISTS cashouts_user_status_idx ON cashouts(user_id, status);
CREATE INDEX IF NOT EXISTS cashouts_status_idx ON cashouts(status, created_at);
CREATE INDEX IF NOT EXISTS logs_user_created_idx ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_created_idx ON outbound_emails(created_at DESC);

INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT (version) DO NOTHING;
