create table if not exists public.place_role_types (
  slug text primary key,
  label text not null,
  sort_order integer not null default 100,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.place_role_types (slug, label, sort_order, is_system) values
  ('cso', 'CSO', 10, true),
  ('crp', 'CRP', 20, true),
  ('incubator', 'Incubator', 30, true),
  ('mentor', 'Mentor', 40, true),
  ('solution_provider', 'Solution Provider', 50, true),
  ('orchestrator', 'Orchestrator', 60, true),
  ('anchor', 'Anchor', 70, true),
  ('govt_body', 'Govt Body', 80, true),
  ('institutes', 'Institutes', 90, true),
  ('individual', 'Individual', 100, true),
  ('community', 'Community', 110, true),
  ('shg', 'SHG', 120, true),
  ('fpo', 'FPO', 130, true),
  ('trader_association', 'Trader Association', 140, true),
  ('others', 'Others', 150, true)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    updated_at = now();

create table if not exists public.place_initiatives (
  id uuid primary key default gen_random_uuid(),
  place_uid text not null unique,
  slug text not null unique,
  initiative_name text not null,
  lead_entity_uid text,
  lead_entity_type_slug text,
  lead_name text,
  lead_role_slug text references public.place_role_types(slug),
  lead_role_label text,
  lead_website_url text,
  lead_thematic_area text,
  states_covered text[] not null default '{}',
  soth_status jsonb not null default '{"Initiate":"not_started","Engage":"not_started","Action":"not_started","Auto Pilot":"not_started"}'::jsonb,
  grameee_status jsonb not null default '{"Triggering":"not_started","Incubating":"not_started","Sustaining":"not_started"}'::jsonb,
  search_text text,
  created_by_name text,
  created_by_email text,
  admin_notes text,
  approval_status text not null default 'approved' check (approval_status in ('approved','pending','rejected')),
  approved_at timestamptz,
  approved_by text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_initiative_locations (
  id uuid primary key default gen_random_uuid(),
  place_uid text not null references public.place_initiatives(place_uid) on delete cascade,
  location_kind text not null check (location_kind in ('state','district','block','village')),
  location_name text not null,
  display_label text not null,
  state_name text,
  district_name text,
  block_name text,
  village_name text,
  latitude double precision,
  longitude double precision,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_initiative_partners (
  id uuid primary key default gen_random_uuid(),
  place_uid text not null references public.place_initiatives(place_uid) on delete cascade,
  partner_kind text not null default 'partner' check (partner_kind in ('lead','partner')),
  entity_uid text,
  entity_type_slug text,
  partner_name text not null,
  role_slug text references public.place_role_types(slug),
  role_label text,
  website_url text,
  thematic_area text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_initiatives_name_idx on public.place_initiatives (lower(initiative_name));
create index if not exists place_initiatives_uid_idx on public.place_initiatives (place_uid);
create index if not exists place_locations_place_uid_idx on public.place_initiative_locations (place_uid);
create index if not exists place_locations_state_idx on public.place_initiative_locations (lower(state_name));
create index if not exists place_locations_display_idx on public.place_initiative_locations (lower(display_label));
create index if not exists place_partners_place_uid_idx on public.place_initiative_partners (place_uid);
create index if not exists place_partners_role_idx on public.place_initiative_partners (role_slug);

create or replace view public.place_initiatives_public as
select *
from public.place_initiatives
where approval_status = 'approved'
  and is_deleted = false;

create or replace view public.place_initiative_locations_public as
select l.*
from public.place_initiative_locations l
join public.place_initiatives p on p.place_uid = l.place_uid
where p.approval_status = 'approved'
  and p.is_deleted = false;

create or replace view public.place_initiative_partners_public as
select pr.*
from public.place_initiative_partners pr
join public.place_initiatives p on p.place_uid = pr.place_uid
where p.approval_status = 'approved'
  and p.is_deleted = false;

alter table public.place_role_types enable row level security;
alter table public.place_initiatives enable row level security;
alter table public.place_initiative_locations enable row level security;
alter table public.place_initiative_partners enable row level security;

drop policy if exists "place role types are public" on public.place_role_types;
create policy "place role types are public"
on public.place_role_types
for select
to anon, authenticated
using (true);

drop policy if exists "place initiatives are public" on public.place_initiatives;
create policy "place initiatives are public"
on public.place_initiatives
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

drop policy if exists "place initiative locations are public" on public.place_initiative_locations;
create policy "place initiative locations are public"
on public.place_initiative_locations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.place_initiatives p
    where p.place_uid = place_initiative_locations.place_uid
      and p.approval_status = 'approved'
      and p.is_deleted = false
  )
);

drop policy if exists "place initiative partners are public" on public.place_initiative_partners;
create policy "place initiative partners are public"
on public.place_initiative_partners
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.place_initiatives p
    where p.place_uid = place_initiative_partners.place_uid
      and p.approval_status = 'approved'
      and p.is_deleted = false
  )
);
