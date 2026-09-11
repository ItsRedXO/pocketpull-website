-- Lets an admin manually pin a species' Bronze/Silver/Gold/Legendary card
-- tier instead of it always being derived from overall_rating / is_legendary
-- / is_mythical. Null (the default) keeps the existing computed behavior.
ALTER TABLE brawl_pokemon_species ADD COLUMN IF NOT EXISTS card_tier_override text
  CHECK (card_tier_override IS NULL OR card_tier_override IN ('bronze', 'silver', 'gold', 'legendary'));
