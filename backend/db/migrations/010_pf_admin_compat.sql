ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS period_start timestamptz;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS period_end timestamptz;
ALTER TABLE server_seeds ADD COLUMN IF NOT EXISTS seed_hash_public text;

CREATE TABLE IF NOT EXISTS admin_credentials (
  id text PRIMARY KEY,
  admin_pass text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
