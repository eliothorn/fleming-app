-- Run this once in the Supabase SQL editor (after schema.sql).
--
-- Sessions were held in a server-memory Map, which works on one long-lived
-- process but breaks on serverless hosting: each request can land on a
-- different, freshly-started instance that has never seen the session, so
-- people get logged out at random. This moves them to the database.
--
-- Only the server (service role) touches this table; RLS is on with no
-- policies, so the anon key cannot read or write it.

create table if not exists public.app_sessions (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists app_sessions_user_idx on public.app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on public.app_sessions(expires_at);

alter table public.app_sessions enable row level security;

-- Housekeeping: drop expired rows. Safe to call on every login.
create or replace function public.purge_expired_sessions()
returns void language sql security definer as $$
  delete from public.app_sessions where expires_at < now();
$$;
