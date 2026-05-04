alter table public.place_document_submissions
  alter column place_uid drop not null;

alter table public.place_spider_chart_submissions
  alter column place_uid drop not null;

alter table public.place_document_submissions
  add column if not exists linked_place_submission_id uuid references public.ecosystem_entity_submissions(id) on delete cascade;

alter table public.place_spider_chart_submissions
  add column if not exists linked_place_submission_id uuid references public.ecosystem_entity_submissions(id) on delete cascade;

create index if not exists place_document_submissions_linked_place_submission_idx
  on public.place_document_submissions (linked_place_submission_id, created_at desc);

create index if not exists place_spider_chart_submissions_linked_place_submission_idx
  on public.place_spider_chart_submissions (linked_place_submission_id, created_at desc);
