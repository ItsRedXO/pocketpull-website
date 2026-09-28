-- Migration 045: Gems currency and Card Shop

ALTER TABLE users ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS gem_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  amount integer NOT NULL,
  balance_before integer NOT NULL DEFAULT 0,
  balance_after integer NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gem_transactions_user_id ON gem_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gem_transactions_created_at ON gem_transactions(created_at);

CREATE TABLE IF NOT EXISTS shop_rotation (
  id text PRIMARY KEY,
  week_start date NOT NULL,
  slot_index integer NOT NULL CHECK (slot_index >= 0 AND slot_index <= 19),
  card_id text,
  pack_id text,
  card_name text NOT NULL,
  card_image_url text,
  card_rarity text,
  estimated_value numeric(10,2) NOT NULL DEFAULT 0,
  gem_price integer NOT NULL DEFAULT 500,
  is_sold boolean NOT NULL DEFAULT false,
  sold_to_user_id text,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_start, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_shop_rotation_week ON shop_rotation(week_start);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  shop_item_id text NOT NULL,
  gems_spent integer NOT NULL,
  inventory_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_user_id ON shop_purchases(user_id);
