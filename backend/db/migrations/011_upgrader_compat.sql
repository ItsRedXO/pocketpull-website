CREATE TABLE IF NOT EXISTS upgrader_multiplier_settings (
  id numeric PRIMARY KEY,
  max_chance numeric(18,6) NOT NULL DEFAULT 75,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
