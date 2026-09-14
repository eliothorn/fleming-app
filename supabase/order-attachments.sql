-- Photos and notes attached to a work order, keyed by its Buildium task id.
--
-- Buildium holds the ticket; it does not hold the resident's photo of the
-- problem or the contractor's photo of the finished job. Until this table
-- existed those were uploaded to storage and then forgotten: a contractor's
-- "Mark work complete" showed "Submitted with photo" until the page reloaded
-- and then showed nothing, and residents had no way to attach a photo at all.
--
-- One row per event. kind='request' is a photo the resident (or staff, filing
-- on their behalf) attached when reporting the problem. kind='completion' is
-- the contractor's proof of finished work, with their note. The app merges
-- these back onto the order when it is loaded (lib/orderAttachments.js).
--
-- Service-role only: RLS is on and there are no policies, the same as every
-- other app table. Paths point into the private fleming-photos bucket and are
-- turned into short-lived URLs by /api/photos, which checks who is asking.
create table if not exists public.order_attachments (
  id            bigserial primary key,
  task_id       bigint      not null,
  kind          text        not null check (kind in ('request', 'completion')),
  path          text,
  note          text,
  by_user       uuid        references auth.users (id) on delete set null,
  by_role       text,
  created_at    timestamptz not null default now()
);

create index if not exists order_attachments_task_idx on public.order_attachments (task_id, created_at);

alter table public.order_attachments enable row level security;
