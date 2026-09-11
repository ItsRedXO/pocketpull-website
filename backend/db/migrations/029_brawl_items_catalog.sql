-- Moves the Item Shop catalog from hardcoded items.ts into the database so
-- admins can edit prices/descriptions, toggle items active/inactive, and add
-- new items without a deploy. Seeded with the same 16 items items.ts already
-- shipped with; ON CONFLICT DO NOTHING so this only runs once and any admin
-- edits afterward are never clobbered by a later deploy.
CREATE TABLE IF NOT EXISTS brawl_items (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  rarity text NOT NULL, -- common | uncommon | rare
  kind text NOT NULL DEFAULT 'other', -- stone | held | other
  price integer NOT NULL,
  sprite_url text,
  active boolean NOT NULL DEFAULT false, -- eligible to be drawn into the shop rotation
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO brawl_items (key, name, description, rarity, kind, price, sprite_url, active) VALUES
  ('fire-stone', 'Fire Stone', 'Evolves certain Pokemon, such as Vulpix and Growlithe, when used.', 'common', 'stone', 800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png', true),
  ('water-stone', 'Water Stone', 'Evolves certain Pokemon, such as Poliwhirl and Shellder, when used.', 'common', 'stone', 800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/water-stone.png', true),
  ('thunder-stone', 'Thunder Stone', 'Evolves certain Pokemon, such as Pikachu and Eevee, when used.', 'common', 'stone', 800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/thunder-stone.png', true),
  ('leaf-stone', 'Leaf Stone', 'Evolves certain Pokemon, such as Gloom and Weepinbell, when used.', 'common', 'stone', 800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leaf-stone.png', true),
  ('moon-stone', 'Moon Stone', 'Evolves certain Pokemon, such as Clefairy and Jigglypuff, when used.', 'common', 'stone', 800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moon-stone.png', true),
  ('sun-stone', 'Sun Stone', 'Evolves certain Pokemon, such as Gloom and Sunkern, when used.', 'uncommon', 'stone', 1800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sun-stone.png', true),
  ('shiny-stone', 'Shiny Stone', 'Evolves certain Pokemon, such as Togetic and Roselia, when used.', 'uncommon', 'stone', 1800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-stone.png', true),
  ('dusk-stone', 'Dusk Stone', 'Evolves certain Pokemon, such as Murkrow and Misdreavus, when used.', 'uncommon', 'stone', 1800, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-stone.png', true),
  ('dawn-stone', 'Dawn Stone', 'Evolves certain gender-specific Pokemon, such as Kirlia and Snorunt, when used.', 'rare', 'stone', 3500, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dawn-stone.png', true),
  ('ice-stone', 'Ice Stone', 'Evolves certain Pokemon, such as Alolan Vulpix and Eevee, when used.', 'rare', 'stone', 3500, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-stone.png', true),
  ('oval-stone', 'Oval Stone', 'Held by Happiny, evolves it into Chansey when leveled up during the day.', 'uncommon', 'held', 2000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oval-stone.png', false),
  ('dragon-scale', 'Dragon Scale', 'Held by Seadra, evolves it into Kingdra when traded.', 'uncommon', 'held', 2000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png', false),
  ('up-grade', 'Up-Grade', 'Held by Porygon, evolves it into Porygon2 when traded.', 'uncommon', 'held', 2000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/up-grade.png', false),
  ('metal-coat', 'Metal Coat', 'Held by Onix or Scyther, evolves them into Steelix or Scizor when traded.', 'rare', 'held', 4000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/metal-coat.png', false),
  ('kings-rock', 'King''s Rock', 'Held by Poliwhirl or Slowpoke, evolves them into Politoed or Slowking when traded.', 'rare', 'held', 4000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/kings-rock.png', false),
  ('razor-claw', 'Razor Claw', 'Held by Sneasel, evolves it into Weavile when leveled up at night.', 'rare', 'held', 4000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/razor-claw.png', false)
ON CONFLICT (key) DO NOTHING;

-- Every existing brawl_item_inventory row was written from the code catalog
-- above (identical keys), so this is safe to add now.
ALTER TABLE brawl_item_inventory ADD CONSTRAINT fk_brawl_item_inventory_item FOREIGN KEY (item_key) REFERENCES brawl_items(key);

-- Staged stock for the *next* rotation, editable/previewable by admins ahead
-- of time instead of only being randomized at the moment of rotation.
ALTER TABLE brawl_item_shop_state ADD COLUMN IF NOT EXISTS next_item_keys text[] NOT NULL DEFAULT '{}';
