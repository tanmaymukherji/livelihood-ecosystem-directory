alter table public.ecosystem_entity_types
  drop constraint if exists ecosystem_entity_types_entity_kind_check;

alter table public.ecosystem_entity_types
  add constraint ecosystem_entity_types_entity_kind_check
  check (entity_kind in ('individual', 'organisation', 'place'));

insert into public.ecosystem_entity_types (type_slug, label, entity_kind, color_hex, sort_order)
values
  ('place', 'Place', 'place', '#7a5c3e', 98)
on conflict (type_slug) do update
set
  label = excluded.label,
  entity_kind = excluded.entity_kind,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.place_entities
  (like public.mentor_entities including defaults including constraints including indexes);

alter table public.place_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;

create index if not exists place_entities_name_idx
  on public.place_entities (lower(entity_name));

alter table public.place_entities enable row level security;

drop policy if exists "place entities are public" on public.place_entities;
create policy "place entities are public"
on public.place_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

insert into public.ecosystem_entity_field_definitions
  (type_slug, field_key, label, input_type, placeholder, help_text, required, options_json, sort_order)
values
  ('place', 'place_kind', 'Place Type', 'select', null, 'Choose the administrative or settlement level of this place.', true, '["Village","Block","Town","District","State"]'::jsonb, 10),
  ('place', 'block_name', 'Block / Taluk / Tehsil', 'text', 'Block, taluk, or tehsil name if relevant', null, false, '[]'::jsonb, 20),
  ('place', 'district_name', 'District', 'text', 'District name', null, true, '[]'::jsonb, 30),
  ('place', 'state_name', 'State', 'text', 'State name', null, true, '[]'::jsonb, 40),
  ('place', 'postal_code', 'Postal Code', 'text', 'Optional postal or PIN code', null, false, '[]'::jsonb, 50),
  ('place', 'location_notes', 'Location Notes', 'textarea', 'Any naming variation, local reference, or boundary note for this place', null, false, '[]'::jsonb, 60)
on conflict (type_slug, field_key) do update
set
  label = excluded.label,
  input_type = excluded.input_type,
  placeholder = excluded.placeholder,
  help_text = excluded.help_text,
  required = excluded.required,
  options_json = excluded.options_json,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.place_spider_chart_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_uid text not null unique,
  place_uid text not null references public.place_entities(entity_uid) on delete cascade,
  place_name text not null,
  recorded_at timestamptz not null,
  title text,
  notes text,
  metrics_json jsonb not null default '{}'::jsonb,
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

create table if not exists public.place_spider_chart_submissions (
  id uuid primary key default gen_random_uuid(),
  place_uid text not null references public.place_entities(entity_uid) on delete cascade,
  place_name text not null,
  recorded_at timestamptz not null,
  title text,
  notes text,
  metrics_json jsonb not null default '{}'::jsonb,
  submitted_by_name text not null,
  submitted_by_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_document_records (
  id uuid primary key default gen_random_uuid(),
  document_uid text not null unique,
  place_uid text not null references public.place_entities(entity_uid) on delete cascade,
  place_name text not null,
  title text not null,
  description text,
  recorded_at timestamptz not null,
  document_date date,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  mime_type text,
  github_sha text,
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

create table if not exists public.place_document_submissions (
  id uuid primary key default gen_random_uuid(),
  place_uid text not null references public.place_entities(entity_uid) on delete cascade,
  place_name text not null,
  title text not null,
  description text,
  recorded_at timestamptz not null,
  document_date date,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  file_content_base64 text not null,
  submitted_by_name text not null,
  submitted_by_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_spider_chart_snapshots_place_uid_idx
  on public.place_spider_chart_snapshots (place_uid, recorded_at desc);
create index if not exists place_spider_chart_submissions_place_uid_idx
  on public.place_spider_chart_submissions (place_uid, created_at desc);
create index if not exists place_document_records_place_uid_idx
  on public.place_document_records (place_uid, recorded_at desc);
create index if not exists place_document_submissions_place_uid_idx
  on public.place_document_submissions (place_uid, created_at desc);

create or replace view public.place_spider_chart_snapshots_public as
select *
from public.place_spider_chart_snapshots
where approval_status = 'approved'
  and is_deleted = false;

create or replace view public.place_document_records_public as
select *
from public.place_document_records
where approval_status = 'approved'
  and is_deleted = false;

alter table public.place_spider_chart_snapshots enable row level security;
alter table public.place_spider_chart_submissions enable row level security;
alter table public.place_document_records enable row level security;
alter table public.place_document_submissions enable row level security;

drop policy if exists "place spider snapshots are public" on public.place_spider_chart_snapshots;
create policy "place spider snapshots are public"
on public.place_spider_chart_snapshots
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

drop policy if exists "place document records are public" on public.place_document_records;
create policy "place document records are public"
on public.place_document_records
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

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
select 'cso'::text, t.label, t.entity_kind, t.color_hex, e.* from public.cso_entities e join public.ecosystem_entity_types t on t.type_slug = 'cso'
union all
select 'csr_philanthropy'::text, t.label, t.entity_kind, t.color_hex, e.* from public.csr_philanthropy_entities e join public.ecosystem_entity_types t on t.type_slug = 'csr_philanthropy'
union all
select 'environmental_expert'::text, t.label, t.entity_kind, t.color_hex, e.* from public.environmental_expert_entities e join public.ecosystem_entity_types t on t.type_slug = 'environmental_expert'
union all
select 'place'::text, t.label, t.entity_kind, t.color_hex, e.* from public.place_entities e join public.ecosystem_entity_types t on t.type_slug = 'place';

create or replace view public.ecosystem_directory_entities as
select *
from public.ecosystem_directory_entities_all
where approval_status = 'approved'
  and is_deleted = false;
