-- Stop the signup trigger handing out roles by email.
--
-- schema.sql seeded match_identity() with the @fleming.test demo people so a
-- fresh install had one account per role. In production the real matching is
-- done in lib/buildium/matcher.js against Buildium, and this table of demo
-- addresses became a hole: the app refused to LOG IN a demo address, but
-- signing UP as one that nobody had claimed (denise@fleming.test) still ran
-- the trigger, which stamped the new profile role=employee. The app now
-- refuses those signups too; this removes the last place a role could be
-- granted by knowing an email address.
--
-- Run once against production. Idempotent. handle_new_user() keeps working:
-- with no rows returned every new profile starts as a pending resident, which
-- is what the matcher then upgrades on a proven sign-in.
create or replace function public.match_identity(p_email text)
returns table(role text, entity jsonb, matched boolean)
language sql stable as $$
  select null::text, null::jsonb, null::boolean where false;
$$;
