-- users.created_at has no column default (see 001_initial_schema.sql) and
-- both live account-creation paths -- POST /auth/complete-supabase-signup
-- (authSupabase.ts) and the legacy Blink self-heal path in useAuth.ts's
-- useUserStats -- omitted it from their INSERT, so it was silently left
-- NULL for every account created since. That showed up in the admin panel
-- as "Created: Invalid Date" and, since ORDER BY created_at DESC puts NULLs
-- first with no defined order among ties, an unstable newest-first sort
-- (see dbProxy.ts's users.list). Both insert paths are fixed alongside this
-- migration; this is the one-time backfill for the handful of real accounts
-- that already went through the broken path before the fix shipped.
--
-- Timestamps recovered per-account from the best available signal:
--   - Supabase-linked accounts: auth.users.created_at (the real signup
--     instant, stamped by Supabase itself).
--   - usr_<uid()> accounts with no Supabase link: the id itself encodes it
--     -- uid() = Date.now().toString(36) + random suffix (backend/lib/auth.ts)
--     -- so the first 8 base36 characters after "usr_" decode back to the
--     creation timestamp.
--   - Legacy Blink-origin accounts (mixed-case id, not the uid() format):
--     the id can't be decoded, so this uses their earliest real activity
--     (first inventory/transaction row) as a close lower-bound proxy.
-- Guarded by "AND created_at IS NULL" throughout so this is a no-op on any
-- rerun once applied.

UPDATE users SET created_at = '2026-09-13 12:41:17.685765+00'
WHERE id = 'usr_mtzt0wzwapfe5l' AND created_at IS NULL; -- Yojimbo, from auth.users

UPDATE users SET created_at = '2026-09-11 01:07:08.166528+00'
WHERE id = 'usr_mtw9c9gyo1wtjo' AND created_at IS NULL; -- Cooc, from auth.users

UPDATE users SET created_at = '2026-09-10 03:00:28.726268+00'
WHERE id = 'usr_AaS9aDByUncd' AND created_at IS NULL; -- ClaudePhase5Fallback, from auth.users

UPDATE users SET created_at = '2026-09-10 03:01:18.488000+00'
WHERE id = 'usr_mtuxxlw845mfrs' AND created_at IS NULL; -- ClaudePhase5Complete, decoded from its own id

UPDATE users SET created_at = '2026-09-15 21:31:02.148264+00'
WHERE id = 'usr_iyS2n8fT7hzN' AND created_at IS NULL; -- Jamezkim (legacy Blink id), earliest inventory row
