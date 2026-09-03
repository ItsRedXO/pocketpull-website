-- Legacy revealed server-seed records may intentionally omit the secret seed.
-- Preserve those records during migration; active/new seeds remain populated by the app.
ALTER TABLE server_seeds ALTER COLUMN seed DROP NOT NULL;
INSERT INTO schema_migrations(version) VALUES (18) ON CONFLICT (version) DO NOTHING;
