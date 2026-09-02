CREATE TABLE IF NOT EXISTS pack_cooldowns (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id text NOT NULL REFERENCES packs_catalog(id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,pack_id)
);
CREATE INDEX IF NOT EXISTS pack_cooldowns_pack_idx ON pack_cooldowns(pack_id,last_opened_at);
INSERT INTO schema_migrations(version) VALUES (4) ON CONFLICT(version) DO NOTHING;
