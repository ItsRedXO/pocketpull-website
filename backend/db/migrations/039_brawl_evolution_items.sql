-- Links specific species evolutions to a required stone item, so Eevee ->
-- Flareon (fire-stone) / Vaporeon (water-stone) / Jolteon (thunder-stone) and
-- the other classic gen-1 stone evolutions -- already described in the item
-- catalog's own flavor text (see 029_brawl_items_catalog.sql, e.g. fire-stone
-- "evolves ... Vulpix and Growlithe") -- can actually be performed: 1 copy of
-- the source species + 1 of the matching stone, no duplicates required, as an
-- alternative to the duplicate-merge evolution path.
CREATE TABLE IF NOT EXISTS brawl_species_evolution_items (
  from_species_id integer NOT NULL REFERENCES brawl_pokemon_species(id),
  to_species_id integer NOT NULL REFERENCES brawl_pokemon_species(id),
  item_key text NOT NULL REFERENCES brawl_items(key),
  PRIMARY KEY (from_species_id, to_species_id)
);

-- Seeded defensively (only inserts a pair if both species rows actually
-- exist locally) so this never fails a deploy that imported a narrower dex
-- range than expected.
INSERT INTO brawl_species_evolution_items (from_species_id, to_species_id, item_key)
SELECT v.from_id, v.to_id, v.item_key FROM (VALUES
  (133, 134, 'water-stone'),   -- Eevee -> Vaporeon
  (133, 135, 'thunder-stone'), -- Eevee -> Jolteon
  (133, 136, 'fire-stone'),    -- Eevee -> Flareon
  (37, 38, 'fire-stone'),      -- Vulpix -> Ninetales
  (58, 59, 'fire-stone'),      -- Growlithe -> Arcanine
  (61, 62, 'water-stone'),     -- Poliwhirl -> Poliwrath
  (90, 91, 'water-stone'),     -- Shellder -> Cloyster
  (120, 121, 'water-stone'),   -- Staryu -> Starmie
  (25, 26, 'thunder-stone'),   -- Pikachu -> Raichu
  (44, 45, 'leaf-stone'),      -- Gloom -> Vileplume
  (70, 71, 'leaf-stone'),      -- Weepinbell -> Victreebel
  (102, 103, 'leaf-stone'),    -- Exeggcute -> Exeggutor
  (30, 31, 'moon-stone'),      -- Nidorina -> Nidoqueen
  (33, 34, 'moon-stone'),      -- Nidorino -> Nidoking
  (35, 36, 'moon-stone'),      -- Clefairy -> Clefable
  (39, 40, 'moon-stone')       -- Jigglypuff -> Wigglytuff
) AS v(from_id, to_id, item_key)
WHERE EXISTS (SELECT 1 FROM brawl_pokemon_species s WHERE s.id = v.from_id)
  AND EXISTS (SELECT 1 FROM brawl_pokemon_species s WHERE s.id = v.to_id)
  AND EXISTS (SELECT 1 FROM brawl_items i WHERE i.key = v.item_key)
ON CONFLICT (from_species_id, to_species_id) DO NOTHING;
