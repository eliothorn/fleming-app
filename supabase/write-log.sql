-- What the app changed in Buildium, and the switch that stops it changing more.
-- Run this in Supabase → SQL Editor BEFORE enabling BUILDIUM_WRITES.
--
-- Both tables are service-role only. Row level security is on with NO policies,
-- which denies every anon and authenticated request; the app reaches them with
-- the service key from server code, which bypasses RLS by design.

create table if not exists public.buildium_writes (
  id               bigserial primary key,
  at               timestamptz not null default now(),

  -- Who asked for it.
  actor_email      text,
  actor_role       text,

  -- What was sent.
  method           text not null,          -- POST | PUT
  path             text not null,          -- e.g. /tasks/residentrequests/2857366
  task_id          bigint,
  request_payload  jsonb,

  -- The record as it stood immediately before. This is the column that makes a
  -- bad update reversible instead of merely traceable — updateOrder already
  -- performs this read to build its payload, so storing it costs nothing.
  before_snapshot  jsonb,

  -- What came back.
  outcome          text not null default 'attempted',  -- attempted | succeeded | failed
  response_status  int,
  response_body    jsonb,
  error            text
);

create index if not exists buildium_writes_at_idx      on public.buildium_writes (at desc);
create index if not exists buildium_writes_task_idx    on public.buildium_writes (task_id);
create index if not exists buildium_writes_outcome_idx on public.buildium_writes (outcome) where outcome <> 'succeeded';

alter table public.buildium_writes enable row level security;

-- Runtime switches that must take effect without a redeploy.
--
-- Changing BUILDIUM_WRITES in Vercel requires a rebuild — minutes, and it assumes
-- the build succeeds while something is going wrong. Setting the row below stops
-- writes within ~20 seconds.
create table if not exists public.app_flags (
  key        text primary key,
  value      jsonb not null,
  note       text,
  updated_at timestamptz not null default now()
);

alter table public.app_flags enable row level security;

-- Present and false = writes allowed. Set to true to halt them immediately:
--
--   update public.app_flags set value = 'true'::jsonb, updated_at = now()
--    where key = 'buildium_writes_halted';
--
-- The app treats a missing row, a missing table, or an unreachable database as
-- "not halted", because the environment variable is still the primary gate and a
-- database blip must not silently disable the office's app. It does keep the last
-- known value through a transient error, so a halt you have just set will not be
-- undone by one failed lookup.
insert into public.app_flags (key, value, note)
values ('buildium_writes_halted', 'false'::jsonb,
        'Set true to stop the app writing to Buildium without a redeploy.')
on conflict (key) do nothing;
