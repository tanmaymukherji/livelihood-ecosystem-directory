insert into public.ecosystem_entity_types (type_slug, label, entity_kind, color_hex, sort_order)
values
  ('story_teller', 'Story Teller', 'individual', '#d97706', 97)
on conflict (type_slug) do update
set
  label = excluded.label,
  entity_kind = excluded.entity_kind,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.story_teller_entities
  (like public.mentor_entities including defaults including constraints including indexes);

alter table public.story_teller_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;

create index if not exists story_teller_entities_name_idx
  on public.story_teller_entities (lower(entity_name));

alter table public.story_teller_entities enable row level security;

drop policy if exists "story teller entities are public" on public.story_teller_entities;
create policy "story teller entities are public"
on public.story_teller_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

insert into public.ecosystem_entity_field_definitions
  (type_slug, field_key, label, input_type, placeholder, help_text, required, options_json, sort_order)
values
  ('story_teller', 'storytelling_modes', 'Mode', 'multiselect', null, 'Capture the storytelling formats this person actively uses.', true, '["Written","Audio","Video","Social Media"]'::jsonb, 10),
  ('story_teller', 'youtube_url', 'YouTube', 'url', 'https://youtube.com/@channel', null, false, '[]'::jsonb, 20),
  ('story_teller', 'instagram_url', 'Instagram', 'url', 'https://instagram.com/handle', null, false, '[]'::jsonb, 30),
  ('story_teller', 'linkedin_url', 'LinkedIn', 'url', 'https://linkedin.com/in/profile', null, false, '[]'::jsonb, 40),
  ('story_teller', 'facebook_url', 'Facebook', 'url', 'https://facebook.com/page', null, false, '[]'::jsonb, 50),
  ('story_teller', 'portfolio_website', 'Website / Portfolio', 'url', 'https://...', null, false, '[]'::jsonb, 60),
  ('story_teller', 'other_social_links', 'Other Social Links', 'textarea', 'Platform | https://...\nPlatform | https://...', 'Use one link per line for additional channels or public profiles.', false, '[]'::jsonb, 70),
  ('story_teller', 'geography_served', 'Geography', 'tags', 'Village, district, state, region, nationwide', 'Capture where this storyteller works, reports, or has audience relevance.', true, '[]'::jsonb, 80),
  ('story_teller', 'languages', 'Language', 'tags', 'Hindi, English, Marathi', 'List the languages this storyteller can create or publish in.', true, '[]'::jsonb, 90),
  ('story_teller', 'reach', 'Reach', 'text', 'Local WhatsApp groups, 25k followers, community radio audience, district readership', 'Capture approximate audience size or channel reach.', false, '[]'::jsonb, 100),
  ('story_teller', 'target_audience', 'Target Audience', 'tags', 'Youth, farmers, women collectives, entrepreneurs, urban consumers', null, false, '[]'::jsonb, 110),
  ('story_teller', 'known_work_links', 'Links to Known Works', 'textarea', 'https://...\nhttps://...', 'Use one line per story, channel, article, reel, or portfolio link.', false, '[]'::jsonb, 120)
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
select 'place'::text, t.label, t.entity_kind, t.color_hex, e.* from public.place_entities e join public.ecosystem_entity_types t on t.type_slug = 'place'
union all
select 'story_teller'::text, t.label, t.entity_kind, t.color_hex, e.* from public.story_teller_entities e join public.ecosystem_entity_types t on t.type_slug = 'story_teller';

create or replace view public.ecosystem_directory_entities as
select *
from public.ecosystem_directory_entities_all
where approval_status = 'approved'
  and is_deleted = false;
