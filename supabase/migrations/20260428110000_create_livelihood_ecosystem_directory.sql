create extension if not exists pgcrypto;

create table if not exists public.ecosystem_admin_accounts (
  username text primary key,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecosystem_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.ecosystem_admin_accounts(username) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.ecosystem_set_admin_password(p_password text)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.ecosystem_admin_accounts (username, password_hash, created_at, updated_at)
  values ('admin', extensions.crypt(p_password, extensions.gen_salt('bf')), now(), now())
  on conflict (username)
  do update set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now();
end;
$$;

create or replace function public.ecosystem_admin_password_matches(p_username text, p_password text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.ecosystem_admin_accounts
    where username = p_username
      and password_hash = extensions.crypt(p_password, password_hash)
  );
$$;

create table if not exists public.ecosystem_entity_types (
  type_slug text primary key,
  label text not null,
  entity_kind text not null check (entity_kind in ('individual','organisation')),
  color_hex text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ecosystem_entity_types (type_slug, label, entity_kind, color_hex, sort_order) values
  ('mentor', 'Mentor', 'individual', '#e76f51', 10),
  ('community_steward', 'Community Steward', 'individual', '#2a9d8f', 20),
  ('volunteer', 'Volunteer', 'individual', '#577590', 30),
  ('intern', 'Intern', 'individual', '#8d99ae', 40),
  ('incubation_centre', 'Incubation Centre', 'organisation', '#f4a261', 50),
  ('accelerator', 'Accelerator', 'organisation', '#264653', 60),
  ('institute', 'Institute', 'organisation', '#6a994e', 70),
  ('trader_association', 'Trader Association', 'organisation', '#b56576', 80),
  ('cso', 'CSO', 'organisation', '#3a86ff', 90)
on conflict (type_slug) do update
set label = excluded.label,
    entity_kind = excluded.entity_kind,
    color_hex = excluded.color_hex,
    sort_order = excluded.sort_order,
    updated_at = now();

create or replace function public.normalize_ecosystem_search_text(
  p_name text,
  p_summary text,
  p_description text,
  p_location text,
  p_address text,
  p_district text,
  p_state text,
  p_country text,
  p_email text,
  p_phone text,
  p_website text,
  p_tags text[],
  p_keywords text[]
)
returns text
language sql
immutable
as $$
  select trim(
    concat_ws(
      ' ',
      coalesce(p_name, ''),
      coalesce(p_summary, ''),
      coalesce(p_description, ''),
      coalesce(p_location, ''),
      coalesce(p_address, ''),
      coalesce(p_district, ''),
      coalesce(p_state, ''),
      coalesce(p_country, ''),
      coalesce(p_email, ''),
      coalesce(p_phone, ''),
      coalesce(p_website, ''),
      array_to_string(coalesce(p_tags, '{}'::text[]), ' '),
      array_to_string(coalesce(p_keywords, '{}'::text[]), ' ')
    )
  );
$$;

create table if not exists public.mentor_entities (
  id uuid primary key default gen_random_uuid(),
  entity_uid text not null unique,
  entity_name text not null,
  summary text,
  description text,
  location_label text,
  primary_address text,
  district text,
  state text,
  country text not null default 'India',
  contact_email text,
  contact_phone text,
  website_url text,
  social_media jsonb not null default '{}'::jsonb,
  office_locations jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  keywords text[] not null default '{}',
  latitude double precision,
  longitude double precision,
  source_label text,
  source_url text,
  created_by_name text,
  created_by_email text,
  admin_notes text,
  approval_status text not null default 'approved' check (approval_status in ('approved','pending','rejected')),
  approved_at timestamptz,
  approved_by text,
  is_deleted boolean not null default false,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_steward_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.volunteer_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.intern_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.incubation_centre_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.accelerator_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.institute_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.trader_association_entities (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.cso_entities (like public.mentor_entities including defaults including constraints including indexes);

create index if not exists mentor_entities_name_idx on public.mentor_entities (lower(entity_name));
create index if not exists community_steward_entities_name_idx on public.community_steward_entities (lower(entity_name));
create index if not exists volunteer_entities_name_idx on public.volunteer_entities (lower(entity_name));
create index if not exists intern_entities_name_idx on public.intern_entities (lower(entity_name));
create index if not exists incubation_centre_entities_name_idx on public.incubation_centre_entities (lower(entity_name));
create index if not exists accelerator_entities_name_idx on public.accelerator_entities (lower(entity_name));
create index if not exists institute_entities_name_idx on public.institute_entities (lower(entity_name));
create index if not exists trader_association_entities_name_idx on public.trader_association_entities (lower(entity_name));
create index if not exists cso_entities_name_idx on public.cso_entities (lower(entity_name));

create table if not exists public.ecosystem_entity_submissions (
  id uuid primary key default gen_random_uuid(),
  entity_type_slug text not null references public.ecosystem_entity_types(type_slug),
  entity_name text not null,
  summary text,
  description text,
  location_label text,
  primary_address text,
  district text,
  state text,
  country text not null default 'India',
  contact_email text,
  contact_phone text,
  website_url text,
  social_media jsonb not null default '{}'::jsonb,
  office_locations jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  keywords text[] not null default '{}',
  latitude double precision,
  longitude double precision,
  source_label text,
  source_url text,
  submitted_by_name text,
  submitted_by_email text not null,
  submitted_by_phone text,
  admin_notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecosystem_contact_requests (
  id uuid primary key default gen_random_uuid(),
  entity_uid text not null,
  request_type text not null check (request_type in ('edit','delete')),
  requester_name text not null,
  requester_email text not null,
  requester_phone text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  notification_status text not null default 'queued',
  notification_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecosystem_import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by text,
  record_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create or replace view public.ecosystem_directory_entities_all as
select 'mentor'::text as entity_type_slug, t.label as entity_type_label, t.entity_kind, t.color_hex, e.* from public.mentor_entities e join public.ecosystem_entity_types t on t.type_slug = 'mentor'
union all
select 'community_steward'::text, t.label, t.entity_kind, t.color_hex, e.* from public.community_steward_entities e join public.ecosystem_entity_types t on t.type_slug = 'community_steward'
union all
select 'volunteer'::text, t.label, t.entity_kind, t.color_hex, e.* from public.volunteer_entities e join public.ecosystem_entity_types t on t.type_slug = 'volunteer'
union all
select 'intern'::text, t.label, t.entity_kind, t.color_hex, e.* from public.intern_entities e join public.ecosystem_entity_types t on t.type_slug = 'intern'
union all
select 'incubation_centre'::text, t.label, t.entity_kind, t.color_hex, e.* from public.incubation_centre_entities e join public.ecosystem_entity_types t on t.type_slug = 'incubation_centre'
union all
select 'accelerator'::text, t.label, t.entity_kind, t.color_hex, e.* from public.accelerator_entities e join public.ecosystem_entity_types t on t.type_slug = 'accelerator'
union all
select 'institute'::text, t.label, t.entity_kind, t.color_hex, e.* from public.institute_entities e join public.ecosystem_entity_types t on t.type_slug = 'institute'
union all
select 'trader_association'::text, t.label, t.entity_kind, t.color_hex, e.* from public.trader_association_entities e join public.ecosystem_entity_types t on t.type_slug = 'trader_association'
union all
select 'cso'::text, t.label, t.entity_kind, t.color_hex, e.* from public.cso_entities e join public.ecosystem_entity_types t on t.type_slug = 'cso';

create or replace view public.ecosystem_directory_entities as
select *
from public.ecosystem_directory_entities_all
where approval_status = 'approved'
  and is_deleted = false;

alter table public.ecosystem_entity_types enable row level security;
alter table public.mentor_entities enable row level security;
alter table public.community_steward_entities enable row level security;
alter table public.volunteer_entities enable row level security;
alter table public.intern_entities enable row level security;
alter table public.incubation_centre_entities enable row level security;
alter table public.accelerator_entities enable row level security;
alter table public.institute_entities enable row level security;
alter table public.trader_association_entities enable row level security;
alter table public.cso_entities enable row level security;
alter table public.ecosystem_entity_submissions enable row level security;
alter table public.ecosystem_contact_requests enable row level security;
alter table public.ecosystem_import_batches enable row level security;

create policy "ecosystem entity types are public"
on public.ecosystem_entity_types
for select
to anon, authenticated
using (true);

create policy "mentor entities are public"
on public.mentor_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "community steward entities are public"
on public.community_steward_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "volunteer entities are public"
on public.volunteer_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "intern entities are public"
on public.intern_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "incubation centre entities are public"
on public.incubation_centre_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "accelerator entities are public"
on public.accelerator_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "institute entities are public"
on public.institute_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "trader association entities are public"
on public.trader_association_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "cso entities are public"
on public.cso_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);
