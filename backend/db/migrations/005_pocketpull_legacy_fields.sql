ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coinbase_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_amount numeric(18,6) NOT NULL DEFAULT 0;

ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS cooldown_hours numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS pack_type text NOT NULL DEFAULT 'standard';
ALTER TABLE packs_catalog ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS estimated_value numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS card_image_url text;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0;
ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS pull_chance numeric(18,10);

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rarity text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_image_url text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pack_name text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pack_id text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_locked integer NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_favorite integer NOT NULL DEFAULT 0;

ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS pack_name text;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS cost numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS rarity text;
ALTER TABLE packs_opened ADD COLUMN IF NOT EXISTS inventory_id text;

ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS odds_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE pack_odds_versions ADD COLUMN IF NOT EXISTS card_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  id text PRIMARY KEY,
  username text,
  biggest_pull numeric(18,6) NOT NULL DEFAULT 0,
  packs_opened integer NOT NULL DEFAULT 0,
  win_streak integer NOT NULL DEFAULT 0,
  upgrades_attempted integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_cards_pack_sort ON pack_cards(pack_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pack_cards_pack_quantity ON pack_cards(pack_id, quantity);
CREATE INDEX IF NOT EXISTS idx_leaderboard_biggest_pull ON leaderboard_stats(biggest_pull DESC);

UPDATE server_seeds SET status = CASE WHEN active = 1 THEN 'active' ELSE COALESCE(status, 'revealed') END WHERE status IS NULL;
UPDATE pack_cards SET card_name = COALESCE(card_name, name), estimated_value = CASE WHEN estimated_value = 0 THEN value ELSE estimated_value END, card_image_url = COALESCE(card_image_url, image_url);
UPDATE inventory SET is_locked = COALESCE(is_locked, locked), is_favorite = COALESCE(is_favorite, favorite);
