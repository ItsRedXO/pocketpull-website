-- Admin-adjustable ranges for the homepage's simulated "live" numbers
-- (Packs Opened Today, Cards Won Today, Live Players Online). Singleton row
-- (id always 1) so reads/writes never need to pick a record.
CREATE TABLE IF NOT EXISTS site_simulation_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  packs_opened_min INTEGER NOT NULL DEFAULT 40000,
  packs_opened_max INTEGER NOT NULL DEFAULT 80000,
  cards_won_min INTEGER NOT NULL DEFAULT 420,
  cards_won_max INTEGER NOT NULL DEFAULT 10420,
  live_players_min INTEGER NOT NULL DEFAULT 150,
  live_players_max INTEGER NOT NULL DEFAULT 250,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_simulation_settings_single_row CHECK (id = 1)
);

INSERT INTO site_simulation_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
