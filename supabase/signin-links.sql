-- Run this once in the Supabase SQL editor (after schema.sql).
--
-- Sign-in links must work exactly once. Measured against this project, the same
-- token hash could be redeemed repeatedly and handed out a fresh session every
-- time — so a link sitting in an inbox stayed a working key for its whole
-- lifetime. Forwarded mail, a shared phone or a compromised mailbox would all
-- have been account access.
--
-- This records the links that have been spent. It deliberately does NOT reuse
-- app_sessions: a row there is a bearer token, and anyone holding the emailed
-- link could then present its hash as a session cookie.
--
-- Only the server (service role) touches this; RLS is on with no policies, so
-- the anon key cannot read or write it.

create table if not exists public.used_signin_links (
  token_hash text primary key,
  used_at    timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists used_signin_links_expiry_idx
  on public.used_signin_links(expires_at);

alter table public.used_signin_links enable row level security;

-- Housekeeping: a spent link only needs remembering until it would have expired
-- anyway. Safe to call on every sign-in.
create or replace function public.purge_used_signin_links()
returns void language sql security definer as $$
  delete from public.used_signin_links where expires_at < now();
$$;
