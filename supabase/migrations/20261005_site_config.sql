-- Create site_config table for persisting admin-editable site settings
CREATE TABLE IF NOT EXISTS public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default hero card positions
INSERT INTO public.site_config (key, value)
VALUES (
  'hero_card_positions',
  '[
    {"name": "Umbreon VMAX", "left": 47.5, "top": 36},
    {"name": "Mewtwo",       "left": 68,   "top": 41},
    {"name": "Charizard",    "left": 81,   "top": 32}
  ]'::jsonb
) ON CONFLICT (key) DO NOTHING;
