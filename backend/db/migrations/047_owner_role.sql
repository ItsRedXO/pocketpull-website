-- Set the site owner role on the primary account
UPDATE users SET role = 'owner' WHERE email = 'lopezdavid689@yahoo.com';

-- Ensure creator role is a recognised value (no constraint needed, text column is open)
-- role values in use: 'owner', 'admin', 'creator', NULL/'' = regular user
