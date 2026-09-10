-- Per-species portrait crop tuning. PokeAPI's official-artwork images are full
-- body and vary wildly in proportions/framing, so one fixed CSS crop makes some
-- Pokemon (e.g. very tall or very small ones) look cut off or awkwardly zoomed.
-- These let an admin nudge the crop per species from the species editor;
-- defaults reproduce the previous fixed crop so nothing changes until tuned.
ALTER TABLE brawl_pokemon_species ADD COLUMN IF NOT EXISTS portrait_scale numeric(4,2) NOT NULL DEFAULT 1.5;
ALTER TABLE brawl_pokemon_species ADD COLUMN IF NOT EXISTS portrait_offset_x numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE brawl_pokemon_species ADD COLUMN IF NOT EXISTS portrait_offset_y numeric(5,2) NOT NULL DEFAULT 0;
