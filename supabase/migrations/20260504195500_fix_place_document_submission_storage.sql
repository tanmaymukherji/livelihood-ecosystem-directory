alter table public.place_document_submissions
  alter column file_content_base64 drop not null;

alter table public.place_document_submissions
  add column if not exists file_path text,
  add column if not exists file_url text,
  add column if not exists github_sha text;
