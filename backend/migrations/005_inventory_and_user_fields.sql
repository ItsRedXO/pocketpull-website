-- PocketPull PostgreSQL migration 005

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS battle_id TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_battle_id ON inventory(battle_id);
