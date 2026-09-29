-- One profile can be pinned to the fictional demo data, in live mode.
--
-- Apple will not review an app they cannot sign into, and every other option
-- was worse: a staff login hands a reviewer every resident's name, address and
-- balance; matching them to a real tenant does the same to one person who never
-- agreed to it; leaving them unmatched shows an empty app, which is what
-- Guideline 4.2 rejects.
--
-- With this flag, lib/buildium/index.js serves that account from the mock store
-- even though BUILDIUM_LIVE is true, so the reviewer sees a complete, working
-- app built entirely from invented people.
--
-- Nothing in the app can set this. It is written once, by hand, with the
-- service key, and lib/auth/supabaseBackend.js refuses to re-match a profile
-- that carries it, so it can never drift onto a real lease.
alter table public.profiles
  add column if not exists demo boolean not null default false;

comment on column public.profiles.demo is
  'Read fictional data even in live mode. Set by hand for the App Store review account only.';
