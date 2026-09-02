CREATE TABLE IF NOT EXISTS wallet_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  amount numeric(18,6) NOT NULL,
  balance_before numeric(18,6) NOT NULL,
  balance_after numeric(18,6) NOT NULL,
  matched_before numeric(18,6) NOT NULL,
  matched_after numeric(18,6) NOT NULL,
  source_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_source_unique ON wallet_transactions(user_id,source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx ON wallet_transactions(user_id,created_at DESC);
INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT(version) DO NOTHING;
