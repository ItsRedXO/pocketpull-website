ALTER TABLE user_nonces ADD COLUMN IF NOT EXISTS upgrade_nonce bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS upgrader_spins (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  multiplier numeric(18,6),
  total_input_value numeric(18,6),
  balance_used numeric(18,6),
  baseline_target_value numeric(18,6),
  total_target_value numeric(18,6),
  win_chance numeric(18,10),
  is_win integer,
  client_seed text,
  nonce bigint,
  roll_value numeric(20,10),
  server_seed_hash text,
  odds_version_hash text,
  won_cards_json text,
  removed_card_ids_json text,
  provably_fair integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_upgrader_spins_user_created ON upgrader_spins(user_id, created_at DESC);
