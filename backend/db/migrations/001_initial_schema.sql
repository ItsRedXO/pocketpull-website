CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text,
  display_name text,
  email text,
  balance numeric(18,6) NOT NULL DEFAULT 0,
  matched_balance numeric(18,6) NOT NULL DEFAULT 0,
  is_deleted integer NOT NULL DEFAULT 0,
  is_banned integer NOT NULL DEFAULT 0,
  first_deposit_bonus_paid integer NOT NULL DEFAULT 0,
  referral_reward_paid integer NOT NULL DEFAULT 0,
  referred_by_id text,
  referral_code text,
  created_at timestamptz,
  updated_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS packs_catalog (
  id text PRIMARY KEY,
  name text,
  price numeric(18,6) NOT NULL DEFAULT 0,
  is_active integer NOT NULL DEFAULT 1,
  quantity_limit integer NOT NULL DEFAULT 0,
  current_quantity integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pack_cards (
  id text PRIMARY KEY,
  pack_id text NOT NULL REFERENCES packs_catalog(id) ON DELETE CASCADE,
  name text,
  rarity text,
  value numeric(18,6) NOT NULL DEFAULT 0,
  odds numeric(18,10),
  image_url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS inventory (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  card_id text,
  pack_id text,
  value numeric(18,6) NOT NULL DEFAULT 0,
  locked integer NOT NULL DEFAULT 0,
  favorite integer NOT NULL DEFAULT 0,
  sold integer NOT NULL DEFAULT 0,
  created_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  amount numeric(18,6) NOT NULL DEFAULT 0,
  matched_amount numeric(18,6) NOT NULL DEFAULT 0,
  description text,
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS packs_opened (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  pack_id text NOT NULL REFERENCES packs_catalog(id),
  inventory_id text,
  client_seed text,
  nonce bigint,
  roll_value numeric(20,10),
  server_seed_hash text,
  odds_version_hash text,
  provably_fair integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS server_seeds (
  id text PRIMARY KEY,
  seed text NOT NULL,
  seed_hash text NOT NULL,
  active integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz
);

CREATE TABLE IF NOT EXISTS pack_odds_versions (
  id text PRIMARY KEY,
  pack_id text NOT NULL REFERENCES packs_catalog(id),
  version integer NOT NULL,
  hash text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, version)
);

CREATE TABLE IF NOT EXISTS user_nonces (
  user_id text PRIMARY KEY REFERENCES users(id),
  nonce bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS battles (
  id text PRIMARY KEY,
  status text NOT NULL,
  mode text,
  host_user_id text REFERENCES users(id),
  is_public integer NOT NULL DEFAULT 1,
  winner_user_id text REFERENCES users(id),
  created_at timestamptz,
  updated_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS battle_participants (
  id text PRIMARY KEY,
  battle_id text NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id),
  slot integer,
  is_bot integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(battle_id, slot)
);

CREATE TABLE IF NOT EXISTS battle_results (
  id text PRIMARY KEY,
  battle_id text NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  participant_id text REFERENCES battle_participants(id),
  value numeric(18,6),
  round integer,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS battle_pull_audits (
  id text PRIMARY KEY,
  battle_id text NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  participant_id text REFERENCES battle_participants(id),
  client_seed text,
  nonce bigint,
  roll_value numeric(20,10),
  server_seed_hash text,
  odds_version_hash text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS upgrader_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS upgrader_history (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exchanger_activity (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cashouts (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  amount numeric(18,6) NOT NULL DEFAULT 0,
  status text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  type text,
  username text,
  action text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  value_in numeric(18,6),
  value_out numeric(18,6),
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outbound_emails (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  recipient text,
  subject text,
  status text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT (version) DO NOTHING;
