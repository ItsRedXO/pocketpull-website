-- PocketPull PostgreSQL migration 002
-- Extends the core schema with all provably-fair/upgrader state used by the
-- current backend routes.

ALTER TABLE server_seeds
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revealed_seed TEXT;

ALTER TABLE user_nonces
  ADD COLUMN IF NOT EXISTS upgrade_nonce BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS upgrader_spins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  multiplier NUMERIC(12,4) NOT NULL,
  total_input_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  balance_used NUMERIC(18,2) NOT NULL DEFAULT 0,
  baseline_target_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_target_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  win_chance NUMERIC(12,8) NOT NULL DEFAULT 0,
  is_win INTEGER NOT NULL DEFAULT 0,
  server_seed_hash TEXT,
  odds_version_hash TEXT,
  client_seed TEXT,
  nonce BIGINT,
  roll_value NUMERIC(20,12),
  won_cards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  removed_card_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  provably_fair INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_upgrader_spins_user_created ON upgrader_spins(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upgrader_spins_seed_hash ON upgrader_spins(server_seed_hash);
