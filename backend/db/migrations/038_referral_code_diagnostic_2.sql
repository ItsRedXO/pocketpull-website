-- Pure diagnostic, no writes. Fresh ground truth on two specific accounts
-- (tydapizzaguy / tyblapierre@gmail.com and Phetii / aaroncoons74@gmail.com)
-- right now -- the admin panel still shows both with a blank referral code
-- and 0 referred users even after the users.list() routing fix deployed and
-- a hard refresh, despite an earlier diagnostic proving tydapizzaguy had a
-- real code ("1P4AA51H") in the DB. Need to see if that's still true or if
-- something wrote over it since.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, email, referral_code, referred_by_id, data, updated_at
    FROM users
    WHERE email IN ('tyblapierre@gmail.com', 'aaroncoons74@gmail.com')
  LOOP
    RAISE NOTICE 'REFDIAG3 email=% id=% referral_code=[%] referred_by_id=% data=% updated_at=%',
      rec.email, rec.id, rec.referral_code, rec.referred_by_id, rec.data, rec.updated_at;
  END LOOP;

  FOR rec IN
    SELECT id, email, referred_by_id FROM users WHERE referred_by_id IN (
      SELECT id FROM users WHERE email IN ('tyblapierre@gmail.com', 'aaroncoons74@gmail.com')
    )
  LOOP
    RAISE NOTICE 'REFDIAG3 referred-by-them email=% id=% referred_by_id=%', rec.email, rec.id, rec.referred_by_id;
  END LOOP;
END $$;
