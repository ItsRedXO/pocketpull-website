-- Keep this migration safe when upgrading a database created from an older
-- foundation schema that used odds_hash/metadata instead of content_hash/odds_json.
DO $$
BEGIN
  IF to_regclass('public.pack_odds_versions') IS NULL THEN
    CREATE TABLE pack_odds_versions (
      id TEXT PRIMARY KEY DEFAULT ('pov_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20)),
      content_hash TEXT NOT NULL UNIQUE,
      pack_id TEXT REFERENCES packs_catalog(id),
      odds_json JSONB,
      card_count INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ELSE
    ALTER TABLE pack_odds_versions
      ADD COLUMN IF NOT EXISTS content_hash TEXT,
      ADD COLUMN IF NOT EXISTS odds_json JSONB,
      ADD COLUMN IF NOT EXISTS card_count INTEGER;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pack_odds_versions' AND column_name='odds_hash'
    ) THEN
      UPDATE pack_odds_versions
      SET content_hash = COALESCE(content_hash, odds_hash)
      WHERE content_hash IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pack_odds_versions' AND column_name='metadata'
    ) THEN
      UPDATE pack_odds_versions
      SET odds_json = COALESCE(odds_json, metadata::jsonb)
      WHERE odds_json IS NULL;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS pack_odds_versions_content_hash_uidx
      ON pack_odds_versions(content_hash)
      WHERE content_hash IS NOT NULL;
  END IF;
END $$;
