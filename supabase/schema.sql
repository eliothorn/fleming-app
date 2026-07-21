-- Fleming Realty - Supabase schema. Run this once in the Supabase SQL editor.
-- Creates a profiles row for every user and assigns their role by matching the
-- signup email to a known identity (later: a lookup against Buildium).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'resident' check (role in ('employee','resident','owner','vendor','applicant')),
  entity jsonb not null default '{}'::jsonb,
  matched boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read only their own profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Known emails -> role/entity. Replace with a Buildium lookup for production.
create or replace function public.match_identity(p_email text)
returns table(role text, entity jsonb, matched boolean)
language sql stable as $$
  select t.role, t.entity, t.matched from (values
    ('marcus@fleming.test', 'employee', '{"name":"Marcus J.","sub":"Leasing and Inspections"}'::jsonb, true),
    ('denise@fleming.test', 'employee', '{"name":"Denise K.","sub":"Inspections"}'::jsonb, true),
    ('robert@fleming.test', 'owner',    '{"name":"Robert H.","sub":"Portfolio Owner"}'::jsonb, true),
    ('sarah@fleming.test',  'resident', '{"name":"Sarah M.","unit":"Unit 4B","address":"214 Walnut St"}'::jsonb, true),
    ('tom@fleming.test',    'resident', '{"name":"Tom B.","unit":"Unit 2A","address":"214 Walnut St"}'::jsonb, true),
    ('daflure@fleming.test','vendor',   '{"name":"Daflure HVAC","vendorId":1,"sub":"HVAC and Plumbing Vendor"}'::jsonb, true),
    ('jordan@fleming.test', 'applicant','{"name":"Jordan K.","sub":"Prospective Resident"}'::jsonb, true)
  ) as t(email, role, entity, matched)
  where t.email = lower(p_email);
$$;

-- On new user, create their profile (matched -> role/entity, else pending resident).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare m record;
begin
  select * into m from public.match_identity(new.email) limit 1;
  if found then
    insert into public.profiles (id, email, role, entity, matched)
    values (new.id, new.email, m.role, m.entity, m.matched);
  else
    insert into public.profiles (id, email, role, entity, matched)
    values (new.id, new.email, 'resident',
            jsonb_build_object('name', coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
                               'unit', 'Pending assignment', 'address', '-'),
            false);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
