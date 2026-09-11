-- Recomputes overall_rating for every existing species using the new
-- Madden-style weighted composite (see computeOverallRating in rating.ts):
-- 50% best stat + 30% second-best + 20% average of the remaining four,
-- instead of a flat average of all six. base_hp/attack/defense/sp_attack/
-- sp_defense/speed are already 1-100-scaled in this table, so this is a
-- pure recompute off stored values -- no re-import needed. Mirrors the JS
-- formula exactly; keep both in sync if the weighting ever changes.
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
