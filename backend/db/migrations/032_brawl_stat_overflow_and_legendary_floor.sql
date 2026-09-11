-- Two fixes to the Poke Brawl rating curve (see rating.ts):
--
-- 1. A literal 100 on any stat should be effectively unreachable, not "tied
--    the single strongest real stat in the dex". Only 4 stats across the 151
--    imported species clamped to 100 (all real stats >= 160, the old
--    reference point) -- their raw values are known Pokemon lore, so this is
--    a direct fix rather than a re-import: Onix/Snorlax sit exactly at the
--    old reference (160) and become 90, Cloyster's 180 Defense becomes 91,
--    and Chansey's dex-topping 250 HP becomes 96. Every other stat in the
--    dex is already < 160 raw, so scaleBaseStat's curve is unchanged for
--    them and this migration leaves them untouched.
UPDATE brawl_pokemon_species SET base_defense = 90 WHERE name = 'onix';
UPDATE brawl_pokemon_species SET base_hp = 90 WHERE name = 'snorlax';
UPDATE brawl_pokemon_species SET base_defense = 91 WHERE name = 'cloyster';
UPDATE brawl_pokemon_species SET base_hp = 96 WHERE name = 'chansey';

-- Recompute overall_rating for everyone (same weighted composite as
-- migration 031) now that the 4 stats above changed.
UPDATE brawl_pokemon_species s
SET overall_rating = sub.overall
FROM (
  SELECT id,
    ROUND(0.5 * vals[1] + 0.3 * vals[2] + 0.2 * ((vals[3] + vals[4] + vals[5] + vals[6]) / 4.0))::int AS overall
  FROM (
    SELECT id, array_agg(v ORDER BY v DESC) AS vals
    FROM brawl_pokemon_species,
      LATERAL (VALUES (base_hp), (base_attack), (base_defense), (base_sp_attack), (base_sp_defense), (base_speed)) AS t(v)
    GROUP BY id
  ) ranked
) sub
WHERE s.id = sub.id;

-- 2. Legendary/Mythical floor: an actual Legendary should never read as
-- "mid" on its card even with a modest stat roll (matches
-- LEGENDARY_OVERALL_FLOOR in rating.ts).
UPDATE brawl_pokemon_species SET overall_rating = 75 WHERE (is_legendary = 1 OR is_mythical = 1) AND overall_rating < 75;
