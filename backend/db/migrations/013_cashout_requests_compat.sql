CREATE TABLE IF NOT EXISTS cashout_requests (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  username text,
  confirmation_number text,
  status text,
  total_value numeric(18,6) NOT NULL DEFAULT 0,
  total_cards integer NOT NULL DEFAULT 0,
  cards_json text NOT NULL DEFAULT '[]',
  shipping_name text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  notes text,
  id_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_status ON cashout_requests(user_id,status);
