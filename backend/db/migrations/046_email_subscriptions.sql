-- Track per-user email marketing subscription preference.
-- Defaults TRUE so existing users remain subscribed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_subscribed BOOLEAN NOT NULL DEFAULT TRUE;
