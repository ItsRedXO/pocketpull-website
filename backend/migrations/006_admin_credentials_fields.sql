ALTER TABLE admin_credentials ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE admin_credentials ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_admin_credentials_username ON admin_credentials(username);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON admin_credentials(email);
