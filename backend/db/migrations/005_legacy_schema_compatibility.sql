-- Compatibility columns/tables used by the existing PocketPull routes and Blink export.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coinbase_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS cooldown_hours numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS pack_type text NOT NULL DEFAULT 'standard';
ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS estimated_value numeric(18,6);
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS pull_chance numeric(18,10);
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS card_image_url text;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS quantity integer;

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rarity text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_image_url text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pack_name text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_locked integer NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_favorite integer NOT NULL DEFAULT 0;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_id text;

ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS pack_name text;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS cost numeric(18,6);
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS rarity text;

ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS period_start timestamptz;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS period_end timestamptz;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS seed_hash_public text;

ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS odds_json jsonb;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS card_count integer;

ALTER TABLE user_nonces ADD COLUMN IF NOT EXISTS pack_nonce bigint NOT NULL DEFAULT 0;
ALTER TABLE user_nonces ADD COLUMN IF NOT EXISTS upgrade_nonce bigint NOT NULL DEFAULT 0;

ALTER TABLE battles ADD COLUMN IF NOT EXISTS host_username text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS host_avatar text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS player_count integer NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS team_mode text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS packs_json jsonb;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS total_cost numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS private_code text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_username text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_value numeric(18,6);
ALTER TABLE battles ADD COLUMN IF NOT EXISTS battle_seed text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS battle_players (
  id text PRIMARY KEY,
  battle_id text NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id),
  username text,
  avatar text,
  is_ai integer NOT NULL DEFAULT 0,
  ai_name text,
  team_side text,
  cards_json jsonb,
  total_value numeric(18,6) NOT NULL DEFAULT 0,
  is_winner integer NOT NULL DEFAULT 0,
  joined_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  id text PRIMARY KEY,
  admin_pass text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upgrader_multiplier_settings (
  id text PRIMARY KEY,
  max_chance numeric(18,6) NOT NULL DEFAULT 75,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upgrader_spins (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
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
  won_cards_json jsonb,
  removed_card_ids_json jsonb,
  provably_fair integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS confirmation_number text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS total_value numeric(18,6);
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS total_cards integer;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS cards_json jsonb;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_name text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_address text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_city text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_state text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_zip text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS shipping_country text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS id_image_url text;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  id text PRIMARY KEY,
  username text,
  biggest_pull numeric(18,6) NOT NULL DEFAULT 0,
  packs_opened integer NOT NULL DEFAULT 0,
  win_streak integer NOT NULL DEFAULT 0,
  upgrades_attempted integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version) VALUES (5) ON CONFLICT(version) DO NOTHING;
