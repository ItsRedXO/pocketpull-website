-- PocketPull PostgreSQL foundation schema
-- Migration branch only. This schema is derived from the exported column inventory.
-- Source IDs are retained as text because the Blink export format has not been
-- contractually established as UUID-only. Money uses NUMERIC(18,2).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  xp BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'user',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_sign_in TIMESTAMPTZ,
  password_hash TEXT,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  referral_code TEXT,
  referred_by_id TEXT REFERENCES users(id),
  referral_reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_method TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  referral_code_used TEXT,
  first_deposit_bonus_paid BOOLEAN NOT NULL DEFAULT FALSE,
  matched_balance NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users(referred_by_id);
CREATE INDEX IF NOT EXISTS users_active_idx ON users(is_deleted, is_banned);

CREATE TABLE IF NOT EXISTS packs_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(18,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  glow_color TEXT,
  border_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  quantity_limit INTEGER,
  current_quantity INTEGER,
  cooldown_hours NUMERIC(12,2),
  expires_at TIMESTAMPTZ,
  name_color TEXT,
  description_color TEXT,
  price_color TEXT,
  button_text_color TEXT,
  open_another_button_text_color TEXT,
  pack_type TEXT
);

CREATE TABLE IF NOT EXISTS pack_cards (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES packs_catalog(id),
  card_name TEXT NOT NULL,
  rarity TEXT,
  pull_chance NUMERIC(18,8),
  estimated_value NUMERIC(18,2),
  card_image_url TEXT,
  sort_order INTEGER,
  quantity INTEGER,
  original_quantity INTEGER
);
CREATE INDEX IF NOT EXISTS pack_cards_pack_idx ON pack_cards(pack_id);

CREATE TABLE IF NOT EXISTS server_seeds (
  id TEXT PRIMARY KEY,
  seed_hash TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  revealed_seed TEXT,
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT
);
CREATE INDEX IF NOT EXISTS server_seeds_status_idx ON server_seeds(status);

CREATE TABLE IF NOT EXISTS user_nonces (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  pack_nonce BIGINT NOT NULL DEFAULT 0,
  upgrade_nonce BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  balance_before NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2) NOT NULL,
  matched_before NUMERIC(18,2) NOT NULL DEFAULT 0,
  matched_after NUMERIC(18,2) NOT NULL DEFAULT 0,
  source_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_transactions_source_idx ON wallet_transactions(source_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS packs_opened (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pack_id TEXT NOT NULL REFERENCES packs_catalog(id),
  pack_name TEXT,
  cost NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  card_name TEXT,
  rarity TEXT,
  client_seed TEXT,
  nonce BIGINT,
  roll_value NUMERIC(30,12),
  odds_version_hash TEXT,
  server_seed_hash TEXT,
  provably_fair BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS packs_opened_user_created_idx ON packs_opened(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS packs_opened_pack_idx ON packs_opened(pack_id);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  card_id TEXT,
  card_name TEXT NOT NULL,
  rarity TEXT,
  value NUMERIC(18,2) NOT NULL DEFAULT 0,
  emoji TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  card_image_url TEXT,
  pack_name TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  battle_id TEXT
);
CREATE INDEX IF NOT EXISTS inventory_user_idx ON inventory(user_id);
CREATE INDEX IF NOT EXISTS inventory_user_locked_idx ON inventory(user_id, is_locked);

CREATE TABLE IF NOT EXISTS pack_cooldowns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pack_id TEXT NOT NULL REFERENCES packs_catalog(id),
  last_opened_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS pack_cooldowns_user_pack_idx ON pack_cooldowns(user_id, pack_id);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  host_user_id TEXT REFERENCES users(id),
  host_username TEXT,
  host_avatar TEXT,
  mode TEXT,
  player_count INTEGER,
  is_public BOOLEAN,
  status TEXT,
  packs_json JSONB,
  total_cost NUMERIC(18,2),
  private_code TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_user_id TEXT REFERENCES users(id),
  winner_username TEXT,
  current_round INTEGER,
  is_spinning BOOLEAN,
  team_mode TEXT
);
CREATE INDEX IF NOT EXISTS battles_status_idx ON battles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS battles_host_idx ON battles(host_user_id);

CREATE TABLE IF NOT EXISTS battle_players (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id),
  user_id TEXT REFERENCES users(id),
  username TEXT,
  avatar TEXT,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  cards_json JSONB,
  total_value NUMERIC(18,2),
  is_winner BOOLEAN,
  team_side TEXT
);
CREATE INDEX IF NOT EXISTS battle_players_battle_idx ON battle_players(battle_id);
CREATE INDEX IF NOT EXISTS battle_players_user_idx ON battle_players(user_id);

CREATE TABLE IF NOT EXISTS battle_pull_audits (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id),
  battle_player_id TEXT REFERENCES battle_players(id),
  user_id TEXT REFERENCES users(id),
  pack_id TEXT REFERENCES packs_catalog(id),
  pack_name TEXT,
  card_name TEXT,
  rarity TEXT,
  cost NUMERIC(18,2),
  client_seed TEXT,
  nonce BIGINT,
  roll_value NUMERIC(30,12),
  server_seed_hash TEXT,
  odds_version_hash TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS battle_pull_audits_battle_idx ON battle_pull_audits(battle_id);
CREATE INDEX IF NOT EXISTS battle_pull_audits_user_idx ON battle_pull_audits(user_id);

CREATE TABLE IF NOT EXISTS battle_results (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id),
  winner_user_id TEXT REFERENCES users(id),
  winner_username TEXT,
  total_pot NUMERIC(18,2),
  mode TEXT,
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS battle_results_battle_idx ON battle_results(battle_id);

CREATE TABLE IF NOT EXISTS upgrader_multiplier_settings (
  multiplier NUMERIC(18,8) PRIMARY KEY,
  max_chance NUMERIC(18,8) NOT NULL
);

CREATE TABLE IF NOT EXISTS upgrader_spins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  multiplier NUMERIC(18,8) NOT NULL,
  total_input_value NUMERIC(18,2) NOT NULL,
  balance_used NUMERIC(18,2) NOT NULL DEFAULT 0,
  baseline_target_value NUMERIC(18,2),
  total_target_value NUMERIC(18,2),
  win_chance NUMERIC(18,8),
  is_win BOOLEAN,
  client_seed TEXT,
  nonce BIGINT,
  roll_value NUMERIC(30,12),
  server_seed_hash TEXT,
  odds_version_hash TEXT,
  won_cards_json JSONB,
  removed_card_ids_json JSONB,
  provably_fair BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS upgrader_spins_user_created_idx ON upgrader_spins(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cashout_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  username TEXT,
  confirmation_number TEXT,
  status TEXT,
  total_value NUMERIC(18,2),
  total_cards INTEGER,
  cards_json JSONB,
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  id_image_url TEXT,
  fulfilled_card_ids JSONB,
  tracking_number TEXT
);
CREATE INDEX IF NOT EXISTS cashout_requests_user_idx ON cashout_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cashout_requests_status_idx ON cashout_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  id TEXT PRIMARY KEY,
  username TEXT,
  biggest_pull NUMERIC(18,2),
  packs_opened BIGINT,
  xp_gained BIGINT,
  win_streak INTEGER,
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  upgrades_attempted BIGINT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  type TEXT,
  user_id TEXT REFERENCES users(id),
  username TEXT,
  action TEXT,
  details TEXT,
  value_in NUMERIC(18,2),
  value_out NUMERIC(18,2),
  result TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx ON activity_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  username TEXT,
  status TEXT,
  subject TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS support_chats_user_idx ON support_chats(user_id);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES support_chats(id),
  user_id TEXT REFERENCES users(id),
  sender_type TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS support_messages_chat_created_idx ON support_messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  lookup_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS email_verification_lookup_idx ON email_verification_tokens(lookup_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  lookup_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_lookup_idx ON password_reset_tokens(lookup_hash);

-- Admin authentication uses password hashes. The legacy admin_credentials export
-- contains an `admin_pass` field and must NOT be imported as plaintext credentials.
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Compatibility marker from Blink. Kept only as migration metadata, not as auth state.
CREATE TABLE IF NOT EXISTS blink_auth_migration (
  id TEXT PRIMARY KEY,
  adopted_users JSONB,
  created_at TIMESTAMPTZ
);

-- Explicitly represented as a configuration/history table; empty exports are valid.
CREATE TABLE IF NOT EXISTS pack_odds_versions (
  id TEXT PRIMARY KEY,
  pack_id TEXT REFERENCES packs_catalog(id),
  odds_hash TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
);

-- These tables were empty in the supplied export and are included so the target
-- schema can support the current application without requiring a later DDL change.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT,
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbound_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  to_email TEXT,
  subject TEXT,
  template TEXT,
  status TEXT,
  provider_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  token_hash TEXT,
  lookup_hash TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS magic_link_lookup_idx ON magic_link_tokens(lookup_hash);
