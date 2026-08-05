-- Run this once in the Supabase SQL editor (after schema.sql).
--
-- Inspection templates are the checklists staff inspect against. They lived in
-- server memory, so a checklist someone built for the broker's properties was
-- lost on the next restart — and on serverless, possibly within minutes of
-- creating it. Same class of bug the inspection reports themselves had.
--
-- Buildium does not own these; they are the company's own working documents,
-- which is why they belong in this database rather than behind the Buildium
-- client.
--
-- Only the server (service role) touches these; RLS is on with no policies, so
-- the anon key cannot read or write them.

create table if not exists public.inspection_templates (
  id          text primary key,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.inspection_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id text not null references public.inspection_templates(id) on delete cascade,
  label       text not null,
  category    text,
  critical    boolean not null default false,
  position    int not null default 0
);

create index if not exists inspection_template_items_tpl_idx
  on public.inspection_template_items(template_id, position);

alter table public.inspection_templates      enable row level security;
alter table public.inspection_template_items enable row level security;

-- Two starter checklists, inserted once. They are ordinary editable rows from
-- here on: renaming or deleting them sticks, and nothing re-creates them.
insert into public.inspection_templates (id, name, description)
values
  ('t1', 'Semi-Annual Standard', 'Full 20-point unit walkthrough'),
  ('t2', 'Move-Out Inspection',  'Turnover & deposit checklist')
on conflict (id) do nothing;

insert into public.inspection_template_items (template_id, label, category, critical, position)
select * from (values
  ('t1', 'Entry doors & locks functional',            'Exterior', true,  0),
  ('t1', 'Windows — no cracks or broken seals',       'Exterior', false, 1),
  ('t1', 'Exterior lighting working',                 'Exterior', false, 2),
  ('t1', 'No visible water damage / staining',        'Exterior', true,  3),
  ('t1', 'Smoke detectors operable',                  'Safety',   true,  4),
  ('t1', 'Carbon monoxide detector operable',         'Safety',   true,  5),
  ('t1', 'Fire extinguisher present & in date',       'Safety',   true,  6),
  ('t1', 'HVAC heating & cooling functional',         'HVAC',     true,  7),
  ('t1', 'Air filter clean',                          'HVAC',     false, 8),
  ('t1', 'No plumbing leaks under sinks',             'Kitchen',  true,  9),
  ('t1', 'Garbage disposal operational',              'Kitchen',  false, 10),
  ('t1', 'Appliances functional',                     'Kitchen',  false, 11),
  ('t1', 'Toilet flushes & seals correctly',          'Bathroom', true,  12),
  ('t1', 'Hot water within normal range',             'Bathroom', true,  13),
  ('t1', 'Exhaust fan working',                       'Bathroom', false, 14),
  ('t1', 'No signs of mould or damp',                 'General',  true,  15),
  ('t1', 'Flooring in serviceable condition',         'General',  false, 16),
  ('t1', 'Walls & ceilings undamaged',                'General',  false, 17),
  ('t1', 'All keys accounted for',                    'Keys',     true,  18),
  ('t1', 'Mailbox key present',                       'Keys',     false, 19),
  ('t2', 'All keys and fobs returned',                'Keys',     true,  0),
  ('t2', 'Unit emptied of personal belongings',       'General',  true,  1),
  ('t2', 'Walls free of holes beyond normal wear',    'General',  false, 2),
  ('t2', 'Carpets cleaned / flooring undamaged',      'General',  false, 3),
  ('t2', 'Appliances clean and functional',           'Kitchen',  false, 4),
  ('t2', 'Bathroom sanitised, no damage',             'Bathroom', false, 5),
  ('t2', 'Smoke detectors still operable',            'Safety',   true,  6),
  ('t2', 'Final meter readings taken',                'General',  true,  7)
) as seed(template_id, label, category, critical, position)
where not exists (select 1 from public.inspection_template_items);
