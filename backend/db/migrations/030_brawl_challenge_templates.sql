-- Moves Challenge templates from hardcoded challenges.ts into the database
-- so admins can edit/activate/deactivate/create them without a deploy.
-- Seeded with the same 10 templates challenges.ts already shipped with;
-- ON CONFLICT DO NOTHING so admin edits afterward survive later deploys.
--
-- label/description may contain the placeholders {Type} / {type}
-- (capitalized / lowercase) -- only meaningful for type = 'win_mono_type',
-- substituted with the challenge's rolled (or fixed_type-pinned) PokeType
-- when a challenge instance is generated from the template.
CREATE TABLE IF NOT EXISTS brawl_challenge_templates (
  key text PRIMARY KEY,
  type text NOT NULL, -- win_matches | win_tournament | evolve_pokemon | open_safari | win_mono_type
  label text NOT NULL,
  description text NOT NULL,
  target integer NOT NULL,
  reward_kind text NOT NULL, -- pokedollars | pokemon
  reward_amount integer,
  reward_overall_min integer,
  reward_overall_max integer,
  fixed_type text, -- win_mono_type only: pin a specific type instead of rolling randomly
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO brawl_challenge_templates (key, type, label, description, target, reward_kind, reward_amount, reward_overall_min, reward_overall_max, active) VALUES
  ('win_3', 'win_matches', 'Win 3 Battles', 'Win 3 Poke Brawl matches, any tier. Losses don''t set you back.', 3, 'pokedollars', 350, NULL, NULL, true),
  ('win_5', 'win_matches', 'Win 5 Battles', 'Win 5 Poke Brawl matches, any tier. Losses don''t set you back.', 5, 'pokedollars', 600, NULL, NULL, true),
  ('win_8', 'win_matches', 'Win 8 Battles', 'Win 8 Poke Brawl matches, any tier. Losses don''t set you back.', 8, 'pokedollars', 1000, NULL, NULL, true),
  ('win_tournament', 'win_tournament', 'Win Any Tournament', 'Clear a Local, State, Regional, or Elite Four tournament run.', 1, 'pokedollars', 800, NULL, NULL, true),
  ('win_tournament_2', 'win_tournament', 'Win 2 Tournaments', 'Clear 2 tournament runs, any tier.', 2, 'pokemon', NULL, 55, 68, true),
  ('evolve_1', 'evolve_pokemon', 'Evolve a Pokemon', 'Merge duplicates to evolve any Pokemon in your roster.', 1, 'pokedollars', 400, NULL, NULL, true),
  ('evolve_2', 'evolve_pokemon', 'Evolve 2 Pokemon', 'Merge duplicates to evolve 2 Pokemon in your roster.', 2, 'pokemon', NULL, 45, 55, true),
  ('safari_3', 'open_safari', 'Open the Safari Zone 3 Times', 'Make 3 Safari Zone pulls, any tier.', 3, 'pokedollars', 700, NULL, NULL, true),
  ('safari_5', 'open_safari', 'Open the Safari Zone 5 Times', 'Make 5 Safari Zone pulls, any tier.', 5, 'pokemon', NULL, 40, 50, true),
  ('mono_type', 'win_mono_type', 'Win an All-{Type} Battle', 'Win a match while fielding a full 6-Pokemon team that''s entirely {type}-type.', 1, 'pokemon', NULL, 50, 60, true)
ON CONFLICT (key) DO NOTHING;
