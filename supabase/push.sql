-- Push notification subscriptions.
-- Run this in Supabase → SQL Editor before enabling notifications.
--
-- One row per device, not per person: someone with a phone and a tablet has two,
-- and both should ring. The endpoint is the browser's own push URL and is unique
-- to that device+browser, which makes it the natural primary key — re-subscribing
-- on the same device updates the row rather than piling up duplicates that would
-- each deliver the same notification.
--
-- Service-role only. RLS is on with no policies, which denies every anon and
-- authenticated request; the app reaches this with the service key from server
-- code, which bypasses RLS by design.

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_sent   timestamptz,
  -- Set when a push provider tells us the subscription is dead (404/410). Kept
  -- rather than deleted so a device that goes quiet can be told apart from one
  -- that was never registered.
  failed_at   timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- ── Native app tokens (added when the Capacitor wrapper was built) ───────────
-- Web push does not work inside an iOS WebView: Apple implements it only for
-- Safari and home-screen web apps. So the App Store build registers with APNs
-- (iOS) or FCM (Android) instead and stores that token here, in the same table,
-- because "which devices does this person have" is one question.
--
-- A native row has a token in `endpoint` and no p256dh/auth, hence the relaxed
-- constraints below.
alter table public.push_subscriptions
  add column if not exists kind text not null default 'web'
    check (kind in ('web', 'ios', 'android'));

alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth   drop not null;

create index if not exists push_subscriptions_kind_idx on public.push_subscriptions (kind);
