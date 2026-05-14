alter table public.place_initiatives
alter column soth_status
set default '{"Initiate":"not_started","Engage":"not_started","Action":"not_started","Expand":"not_started","Auto Pilot":"not_started"}'::jsonb;

update public.place_initiatives
set
  soth_status = jsonb_build_object(
    'Initiate', coalesce(soth_status->>'Initiate', 'not_started'),
    'Engage', coalesce(soth_status->>'Engage', 'not_started'),
    'Action', coalesce(soth_status->>'Action', 'not_started'),
    'Expand', 'not_started',
    'Auto Pilot', coalesce(soth_status->>'Auto Pilot', 'not_started')
  ),
  updated_at = now()
where coalesce(soth_status->>'Expand', '') = '';
