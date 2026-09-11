-- Duplicate/evolution merge system: N copies of a species merge into the next
-- evolution stage, and N copies of a fully-evolved species merge upward into
-- star levels (0-3), each star unlocking one held-item slot.
--
-- evolves_to holds the national dex ids this species evolves into directly
-- (usually one; a small branch like Eevee has several, letting the player
-- choose). Empty for fully-evolved / single-stage species. Backfilled by
-- re-running backend/db/import/importPokeBrawlSpecies.ts.
ALTER TABLE brawl_pokemon_species ADD COLUMN IF NOT EXISTS evolves_to integer[] NOT NULL DEFAULT '{}';

ALTER TABLE brawl_pokemon_instances ADD COLUMN IF NOT EXISTS star_level smallint NOT NULL DEFAULT 0 CHECK (star_level BETWEEN 0 AND 3);
