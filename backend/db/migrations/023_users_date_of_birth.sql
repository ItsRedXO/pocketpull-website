-- Records the date of birth users confirm at signup, so the 18+ requirement
-- enforced there (client-side for immediate feedback, server-side as the
-- real gate) has an auditable record behind it. Nullable: existing accounts
-- predate this column and were never asked.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth date;
