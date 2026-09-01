CREATE TABLE IF NOT EXISTS pack_odds_versions (
  id TEXT PRIMARY KEY DEFAULT ('pov_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20)),
  content_hash TEXT NOT NULL UNIQUE,
  pack_id TEXT REFERENCES packs_catalog(id),
  odds_json JSONB,
  card_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
