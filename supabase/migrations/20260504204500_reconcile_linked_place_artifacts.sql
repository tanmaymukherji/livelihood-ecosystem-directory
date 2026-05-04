with approved_places as (
  select
    s.id as submission_id,
    s.entity_name as submission_place_name,
    p.entity_uid,
    p.entity_name,
    coalesce(p.approved_at, p.created_at, now()) as approved_at,
    coalesce(p.approved_by, s.reviewed_by, 'system') as approved_by
  from public.ecosystem_entity_submissions s
  join lateral (
    select pe.*
    from public.place_entities pe
    where pe.approval_status = 'approved'
      and pe.is_deleted = false
      and lower(pe.entity_name) = lower(s.entity_name)
    order by coalesce(pe.approved_at, pe.created_at) desc, pe.created_at desc
    limit 1
  ) p on true
  where s.entity_type_slug = 'place'
    and s.status = 'approved'
),
inserted_spiders as (
  insert into public.place_spider_chart_snapshots (
    snapshot_uid,
    place_uid,
    place_name,
    recorded_at,
    title,
    notes,
    metrics_json,
    created_by_name,
    created_by_email,
    admin_notes,
    approval_status,
    approved_at,
    approved_by,
    is_deleted,
    created_at,
    updated_at
  )
  select
    'place-spider-reconcile-' || replace(ps.id::text, '-', '') as snapshot_uid,
    ap.entity_uid,
    ap.entity_name,
    ps.recorded_at,
    ps.title,
    ps.notes,
    ps.metrics_json,
    ps.submitted_by_name,
    ps.submitted_by_email,
    coalesce(ps.admin_notes, 'Reconciled from linked place submission'),
    'approved',
    ap.approved_at,
    ap.approved_by,
    false,
    ps.created_at,
    now()
  from public.place_spider_chart_submissions ps
  join approved_places ap on ap.submission_id = ps.linked_place_submission_id
  where ps.status = 'pending'
    and not exists (
      select 1
      from public.place_spider_chart_snapshots existing
      where existing.snapshot_uid = 'place-spider-reconcile-' || replace(ps.id::text, '-', '')
    )
  on conflict (snapshot_uid) do nothing
  returning snapshot_uid
)
update public.place_spider_chart_submissions ps
set
  place_uid = ap.entity_uid,
  status = 'approved',
  admin_notes = coalesce(ps.admin_notes, 'Approved with parent place by reconciliation'),
  updated_at = now()
from approved_places ap
where ap.submission_id = ps.linked_place_submission_id
  and ps.status = 'pending';

with approved_places as (
  select
    s.id as submission_id,
    s.entity_name as submission_place_name,
    p.entity_uid,
    p.entity_name,
    coalesce(p.approved_at, p.created_at, now()) as approved_at,
    coalesce(p.approved_by, s.reviewed_by, 'system') as approved_by
  from public.ecosystem_entity_submissions s
  join lateral (
    select pe.*
    from public.place_entities pe
    where pe.approval_status = 'approved'
      and pe.is_deleted = false
      and lower(pe.entity_name) = lower(s.entity_name)
    order by coalesce(pe.approved_at, pe.created_at) desc, pe.created_at desc
    limit 1
  ) p on true
  where s.entity_type_slug = 'place'
    and s.status = 'approved'
)
insert into public.place_document_records (
  document_uid,
  place_uid,
  place_name,
  title,
  description,
  recorded_at,
  document_date,
  file_name,
  file_path,
  file_url,
  mime_type,
  github_sha,
  created_by_name,
  created_by_email,
  admin_notes,
  approval_status,
  approved_at,
  approved_by,
  is_deleted,
  created_at,
  updated_at
)
select
  'place-doc-reconcile-' || replace(pd.id::text, '-', '') as document_uid,
  ap.entity_uid,
  ap.entity_name,
  pd.title,
  pd.description,
  pd.recorded_at,
  pd.document_date,
  pd.file_name,
  pd.file_path,
  pd.file_url,
  pd.mime_type,
  pd.github_sha,
  pd.submitted_by_name,
  pd.submitted_by_email,
  coalesce(pd.admin_notes, 'Reconciled from linked place submission'),
  'approved',
  ap.approved_at,
  ap.approved_by,
  false,
  pd.created_at,
  now()
from public.place_document_submissions pd
join approved_places ap on ap.submission_id = pd.linked_place_submission_id
where pd.status = 'pending'
  and coalesce(pd.file_path, '') <> ''
  and coalesce(pd.file_url, '') <> ''
  and not exists (
    select 1
    from public.place_document_records existing
    where existing.document_uid = 'place-doc-reconcile-' || replace(pd.id::text, '-', '')
  )
on conflict (document_uid) do nothing;

with approved_places as (
  select
    s.id as submission_id,
    p.entity_uid
  from public.ecosystem_entity_submissions s
  join lateral (
    select pe.*
    from public.place_entities pe
    where pe.approval_status = 'approved'
      and pe.is_deleted = false
      and lower(pe.entity_name) = lower(s.entity_name)
    order by coalesce(pe.approved_at, pe.created_at) desc, pe.created_at desc
    limit 1
  ) p on true
  where s.entity_type_slug = 'place'
    and s.status = 'approved'
)
update public.place_document_submissions pd
set
  place_uid = ap.entity_uid,
  status = case
    when coalesce(pd.file_path, '') <> '' and coalesce(pd.file_url, '') <> '' then 'approved'
    else pd.status
  end,
  admin_notes = coalesce(pd.admin_notes, 'Approved with parent place by reconciliation'),
  updated_at = now()
from approved_places ap
where ap.submission_id = pd.linked_place_submission_id
  and pd.status = 'pending';
