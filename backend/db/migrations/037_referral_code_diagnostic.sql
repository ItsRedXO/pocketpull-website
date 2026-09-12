-- Pure diagnostic -- no writes. The previous two backfills both reported a
-- successful commit in the deploy log, yet the admin panel still shows most
-- users with a blank code, so this checks what's actually in the users
-- table right now instead of continuing to guess from the outside.
DO $$
DECLARE
  total_users integer;
  blank_users integer;
  redxo_code text;
  redxo_id text;
  referred_count integer;
  sample record;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO blank_users FROM users WHERE referral_code IS NULL OR referral_code = '';
  RAISE NOTICE 'REFDIAG total_users=% blank_users=%', total_users, blank_users;

  SELECT id, referral_code INTO redxo_id, redxo_code FROM users WHERE email = 'lopezdavid689@yahoo.com' LIMIT 1;
  RAISE NOTICE 'REFDIAG itsredxo id=% referral_code=%', redxo_id, redxo_code;

  IF redxo_id IS NOT NULL THEN
    SELECT COUNT(*) INTO referred_count FROM users WHERE referred_by_id = redxo_id;
    RAISE NOTICE 'REFDIAG itsredxo referred_count=%', referred_count;
  END IF;

  FOR sample IN
    SELECT id, email, referral_code, referred_by_id
    FROM users
    WHERE email IN ('tyblapierre@gmail.com', 'stephaniecarissa01@gmail.com', 'bakugan33@yahoo.com')
  LOOP
    RAISE NOTICE 'REFDIAG sample email=% id=% referral_code=[%] referred_by_id=%', sample.email, sample.id, sample.referral_code, sample.referred_by_id;
  END LOOP;
END $$;
