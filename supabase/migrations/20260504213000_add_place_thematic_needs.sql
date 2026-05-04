create table if not exists public.place_thematic_need_records (
  id uuid primary key default gen_random_uuid(),
  need_uid text not null unique,
  place_uid text not null references public.place_entities(entity_uid) on delete cascade,
  place_name text not null,
  thematic_needs text[] not null default '{}',
  details text,
  updated_by_org text not null,
  updated_by_name text,
  updated_by_email text,
  recorded_at timestamptz not null,
  admin_notes text,
  approval_status text not null default 'approved' check (approval_status in ('approved','pending','rejected')),
  approved_at timestamptz,
  approved_by text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_thematic_need_submissions (
  id uuid primary key default gen_random_uuid(),
  place_uid text references public.place_entities(entity_uid) on delete cascade,
  linked_place_submission_id uuid references public.ecosystem_entity_submissions(id) on delete cascade,
  place_name text not null,
  thematic_needs text[] not null default '{}',
  details text,
  updated_by_org text not null,
  updated_by_name text,
  updated_by_email text not null,
  recorded_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_thematic_need_records_place_uid_idx
  on public.place_thematic_need_records (place_uid, recorded_at desc);

create index if not exists place_thematic_need_submissions_place_uid_idx
  on public.place_thematic_need_submissions (place_uid, created_at desc);

create index if not exists place_thematic_need_submissions_linked_place_submission_idx
  on public.place_thematic_need_submissions (linked_place_submission_id, created_at desc);

create or replace view public.place_thematic_need_records_public as
select *
from public.place_thematic_need_records
where approval_status = 'approved'
  and is_deleted = false;

alter table public.place_thematic_need_records enable row level security;
alter table public.place_thematic_need_submissions enable row level security;

drop policy if exists "place thematic need records are public" on public.place_thematic_need_records;
create policy "place thematic need records are public"
on public.place_thematic_need_records
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);
