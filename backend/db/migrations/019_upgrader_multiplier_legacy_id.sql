-- Legacy Blink upgrader multiplier settings may have a null singleton id.
-- The PostgreSQL compatibility table requires an id, so normalize null legacy ids to 1.
CREATE OR REPLACE FUNCTION normalize_upgrader_multiplier_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.id IS NULL THEN NEW.id := 1; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_upgrader_multiplier_id ON upgrader_multiplier_settings;
CREATE TRIGGER trg_normalize_upgrader_multiplier_id
BEFORE INSERT OR UPDATE ON upgrader_multiplier_settings
FOR EACH ROW EXECUTE FUNCTION normalize_upgrader_multiplier_id();

INSERT INTO schema_migrations(version) VALUES (19) ON CONFLICT (version) DO NOTHING;