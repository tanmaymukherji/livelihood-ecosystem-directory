create table if not exists public.lgd_geography_directory (
  entry_uid text primary key,
  location_kind text not null check (location_kind in ('state', 'district', 'block', 'panchayat', 'village')),
  lgd_code text not null,
  state_code text,
  district_code text,
  subdistrict_code text,
  local_body_code text,
  village_code text,
  state_name text,
  district_name text,
  block_name text,
  gram_panchayat_name text,
  village_name text,
  display_label text not null,
  search_text text not null,
  source_name text not null default 'LGD',
  source_updated_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lgd_geography_directory_kind_code_idx
on public.lgd_geography_directory (location_kind, lgd_code);

create index if not exists lgd_geography_directory_display_idx
on public.lgd_geography_directory (lower(display_label));

create index if not exists lgd_geography_directory_state_idx
on public.lgd_geography_directory (lower(state_name));

create index if not exists lgd_geography_directory_district_idx
on public.lgd_geography_directory (lower(district_name));

create index if not exists lgd_geography_directory_block_idx
on public.lgd_geography_directory (lower(block_name));

create index if not exists lgd_geography_directory_panchayat_idx
on public.lgd_geography_directory (lower(gram_panchayat_name));

create index if not exists lgd_geography_directory_village_idx
on public.lgd_geography_directory (lower(village_name));

create or replace view public.lgd_geography_directory_public as
select *
from public.lgd_geography_directory;

alter table public.lgd_geography_directory enable row level security;

drop policy if exists "lgd geography directory is public" on public.lgd_geography_directory;
create policy "lgd geography directory is public"
on public.lgd_geography_directory
for select
to anon, authenticated
using (true);

alter table public.place_initiative_locations
  drop constraint if exists place_initiative_locations_location_kind_check;

alter table public.place_initiative_locations
  add constraint place_initiative_locations_location_kind_check
  check (location_kind in ('state', 'district', 'block', 'panchayat', 'village'));

alter table public.place_initiative_locations
  add column if not exists lgd_entry_uid text,
  add column if not exists lgd_state_code text,
  add column if not exists lgd_district_code text,
  add column if not exists lgd_subdistrict_code text,
  add column if not exists lgd_local_body_code text,
  add column if not exists lgd_village_code text,
  add column if not exists gram_panchayat_name text;

create index if not exists place_locations_lgd_entry_uid_idx
on public.place_initiative_locations (lgd_entry_uid);

create index if not exists place_locations_panchayat_idx
on public.place_initiative_locations (lower(gram_panchayat_name));
