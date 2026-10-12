-- Run this once in the Supabase SQL editor (after schema.sql).
--
-- Who has already been invited to the app. A rollout to 600+ residents cannot
-- go out in one send: the email provider's free tier caps the day, and sending
-- to everyone at once means nobody is watching when the first batch bounces.
-- So invitations go out in batches over days, and this table is what stops the
-- second batch re-emailing the first.
--
-- Rows are keyed by email because that is what the resident signs in with and
-- what Buildium guarantees is unique per person. A send that FAILS is recorded
-- too, with `error` set, so a bad address is visible rather than silently
-- retried on every batch forever — but it stays retryable, because most send
-- failures are transient and a resident should not be locked out of the rollout
-- by one bad afternoon at the mail provider.
--
-- Only the server (service role) touches this; RLS is on with no policies, so
-- the anon key can neither read nor write it.

create table if not exists public.resident_invites (
  email       text primary key,
  tenant_id   bigint,
  name        text,
  unit        text,
  property_id bigint,
  property    text,
  invited_at  timestamptz not null default now(),
  invited_by  text,
  provider_id text,
  error       text
);

-- The two questions the rollout screen asks: how is one property doing, and
-- what went out most recently.
create index if not exists resident_invites_property_idx
  on public.resident_invites(property_id);

create index if not exists resident_invites_invited_at_idx
  on public.resident_invites(invited_at desc);

alter table public.resident_invites enable row level security;
