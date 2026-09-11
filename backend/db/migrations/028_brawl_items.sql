-- Poke Brawl Items: a single shared shop (item_keys = today's 10-item stock,
-- rotated every 24h -- see pickShopItems in items.ts) plus each player's
-- owned item counts.
CREATE TABLE IF NOT EXISTS brawl_item_shop_state (
  id smallint PRIMARY KEY DEFAULT 1,
  item_keys text[] NOT NULL DEFAULT '{}',
  rotated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brawl_item_inventory (
  user_id text NOT NULL REFERENCES users(id),
  item_key text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
