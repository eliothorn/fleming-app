-- Run once in the Supabase SQL editor (after schema.sql and sessions.sql).
--
-- Inspections lived in server memory, so a completed report — and the photo
-- evidence attached to it — disappeared on restart. That is the one record in
-- this app that most needs to be permanent: it is what the owner is shown and
-- what the company would rely on in a dispute.
--
-- Only the server (service role) reads or writes these; RLS is on with no
-- policies so the anon key cannot reach them.

create table if not exists public.inspections (
  id                uuid primary key default gen_random_uuid(),
  property          text not null,
  scope             text,
  performed_by      uuid references auth.users(id) on delete set null,
  performed_by_name text,
  performed_on      date not null default current_date,
  next_date         text,
  passed            integer not null default 0,
  failed            integer not null default 0,
  created_at        timestamptz not null default now()
);

-- One row per checklist line, so a report keeps its detail rather than a
-- pass/fail tally: which item failed, the inspector's note, and its photo.
create table if not exists public.inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  label         text not null,
  category      text,
  critical      boolean not null default false,
  result        text check (result in ('pass','fail')),
  note          text,
  photo_path    text,           -- object path in the private fleming-photos bucket
  position      integer not null default 0
);

create index if not exists inspections_created_idx on public.inspections(created_at desc);
create index if not exists inspection_items_parent_idx on public.inspection_items(inspection_id);

alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
