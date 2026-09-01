-- Compatibility adjustments learned from the authoritative Blink export/import.
-- These relax only relationships that are not valid for historical records.

ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE admin_users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE packs_opened DROP CONSTRAINT IF EXISTS packs_opened_pack_id_fkey;
ALTER TABLE battles DROP CONSTRAINT IF EXISTS battles_winner_user_id_fkey;
ALTER TABLE battle_players DROP CONSTRAINT IF EXISTS battle_players_user_id_fkey;
ALTER TABLE battle_pull_audits DROP CONSTRAINT IF EXISTS battle_pull_audits_user_id_fkey;
ALTER TABLE battle_pull_audits DROP CONSTRAINT IF EXISTS battle_pull_audits_battle_player_id_fkey;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

-- The foundation schema historically defined pack_odds_versions with the
-- generic odds_hash/metadata shape, while the application repository uses the
-- richer content_hash/odds_json/card_count contract. Reconcile both shapes so
-- a database created from schema.sql can safely run the application migration.
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS odds_json JSONB;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS card_count INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS pack_odds_versions_content_hash_idx
  ON pack_odds_versions(content_hash)
  WHERE content_hash IS NOT NULL;
