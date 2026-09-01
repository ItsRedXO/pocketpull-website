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
