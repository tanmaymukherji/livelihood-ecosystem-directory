create table if not exists public.place_partner_match_cache (
  place_uid text primary key references public.place_initiatives(place_uid) on delete cascade,
  initiative_name text,
  ai_provider text not null default 'none' check (ai_provider in ('none', 'rules', 'gemini', 'openai')),
  need_groups jsonb not null default '[]'::jsonb,
  potential_partner_groups jsonb not null default '{}'::jsonb,
  candidate_entity_count integer not null default 0,
  need_record_count integer not null default 0,
  last_sync_reason text,
  synced_by text,
  refreshed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.place_partner_match_cache_public as
select c.*
from public.place_partner_match_cache c
join public.place_initiatives p on p.place_uid = c.place_uid
where p.approval_status = 'approved'
  and p.is_deleted = false;

create index if not exists place_partner_match_cache_refreshed_idx
  on public.place_partner_match_cache (refreshed_at desc);

alter table public.place_partner_match_cache enable row level security;

drop policy if exists "place partner match cache is public" on public.place_partner_match_cache;
create policy "place partner match cache is public"
on public.place_partner_match_cache
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.place_initiatives p
    where p.place_uid = place_partner_match_cache.place_uid
      and p.approval_status = 'approved'
      and p.is_deleted = false
  )
);
