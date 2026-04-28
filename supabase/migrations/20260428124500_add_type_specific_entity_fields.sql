alter table public.mentor_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.community_steward_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.volunteer_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.intern_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.incubation_centre_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.accelerator_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.institute_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.trader_association_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.cso_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.ecosystem_entity_submissions add column if not exists type_specific_data jsonb not null default '{}'::jsonb;

create table if not exists public.ecosystem_entity_field_definitions (
  id uuid primary key default gen_random_uuid(),
  type_slug text not null references public.ecosystem_entity_types(type_slug) on delete cascade,
  field_key text not null,
  label text not null,
  input_type text not null check (input_type in ('text','textarea','url','email','number','select','multiselect','tags')),
  placeholder text,
  help_text text,
  required boolean not null default false,
  options_json jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type_slug, field_key)
);

delete from public.ecosystem_entity_field_definitions;

insert into public.ecosystem_entity_field_definitions
  (type_slug, field_key, label, input_type, placeholder, help_text, required, options_json, sort_order)
values
  ('mentor', 'domain_expertise', 'Domain Expertise', 'tags', 'Agriculture finance, enterprise strategy, HR, market access', 'Inspired by public mentor matching patterns that emphasize expertise, industry, language, and location.', true, '[]'::jsonb, 10),
  ('mentor', 'industry_experience', 'Industry Experience', 'tags', 'Agri-tech, livelihoods, retail, manufacturing', null, false, '[]'::jsonb, 20),
  ('mentor', 'years_experience', 'Years of Experience', 'number', '10', null, false, '[]'::jsonb, 30),
  ('mentor', 'languages_spoken', 'Languages Spoken', 'tags', 'Hindi, English, Kannada', null, false, '[]'::jsonb, 40),
  ('mentor', 'mentoring_modes', 'Mentoring Modes', 'multiselect', null, 'Phone, video, and in-person are common mentor matching dimensions.', false, '["In person","Phone","Video call","WhatsApp","Email"]'::jsonb, 50),
  ('mentor', 'geography_served', 'Geography Served', 'tags', 'Districts, states, or regions served', null, false, '[]'::jsonb, 60),
  ('mentor', 'target_stage', 'Target Stage', 'multiselect', null, 'Startup India incubator and accelerator profiles commonly segment by stage.', false, '["Idea stage","Prototype","Early revenue","Growth","Scale"]'::jsonb, 70),
  ('mentor', 'availability_notes', 'Availability Notes', 'textarea', 'Weekly office hours, preferred days, response time', null, false, '[]'::jsonb, 80),

  ('community_steward', 'community_focus', 'Community Focus', 'tags', 'Women SHGs, youth, artisans, farmers', null, true, '[]'::jsonb, 10),
  ('community_steward', 'geography_served', 'Geography Served', 'tags', 'Village, block, district', null, true, '[]'::jsonb, 20),
  ('community_steward', 'languages_spoken', 'Languages Spoken', 'tags', 'Hindi, Odia, Bengali', null, false, '[]'::jsonb, 30),
  ('community_steward', 'support_areas', 'Support Areas', 'tags', 'Mobilisation, training, market linkage, local coordination', null, false, '[]'::jsonb, 40),
  ('community_steward', 'affiliation', 'Affiliation / Network', 'text', 'Community institution or local platform', null, false, '[]'::jsonb, 50),
  ('community_steward', 'availability_notes', 'Availability Notes', 'textarea', 'When and how this steward can be reached', null, false, '[]'::jsonb, 60),

  ('volunteer', 'skills', 'Skills', 'tags', 'Data collection, design, event support, translation', null, true, '[]'::jsonb, 10),
  ('volunteer', 'cause_areas', 'Cause Areas', 'tags', 'Education, climate, livelihoods, skilling', null, false, '[]'::jsonb, 20),
  ('volunteer', 'languages_spoken', 'Languages Spoken', 'tags', 'Hindi, English, Tamil', null, false, '[]'::jsonb, 30),
  ('volunteer', 'availability_type', 'Availability Type', 'select', null, null, false, '["Weekdays","Weekends","Flexible","Project based"]'::jsonb, 40),
  ('volunteer', 'availability_hours', 'Availability Hours / Time Band', 'text', '5 hrs/week, evenings only, full days on weekends', null, false, '[]'::jsonb, 50),
  ('volunteer', 'preferred_geography', 'Preferred Geography', 'tags', 'Remote, district, state, onsite locations', null, false, '[]'::jsonb, 60),
  ('volunteer', 'past_experience', 'Past Volunteer Experience', 'textarea', 'Short description of previous roles or community work', null, false, '[]'::jsonb, 70),

  ('intern', 'field_of_study', 'Field of Study', 'tags', 'Rural development, commerce, design, engineering', null, true, '[]'::jsonb, 10),
  ('intern', 'current_institution', 'Current Institution', 'text', 'College, university, or training institute', null, false, '[]'::jsonb, 20),
  ('intern', 'education_level', 'Education Level', 'select', null, null, false, '["Diploma","Undergraduate","Postgraduate","Fellowship","Other"]'::jsonb, 30),
  ('intern', 'skills', 'Skills', 'tags', 'Research, field surveys, Excel, GIS, communications', null, true, '[]'::jsonb, 40),
  ('intern', 'availability_period', 'Availability Period', 'text', 'May-July 2026, 3 months full time', null, true, '[]'::jsonb, 50),
  ('intern', 'preferred_domains', 'Preferred Domains', 'tags', 'Livelihoods, market systems, finance, design', null, false, '[]'::jsonb, 60),
  ('intern', 'preferred_geography', 'Preferred Geography', 'tags', 'Remote, district, state, onsite locations', null, false, '[]'::jsonb, 70),
  ('intern', 'stipend_expectation', 'Stipend Expectation', 'text', 'Optional stipend expectation or note', null, false, '[]'::jsonb, 80),

  ('incubation_centre', 'thematic_areas', 'Thematic Areas', 'tags', 'Agriculture, circular economy, climate, health', null, true, '[]'::jsonb, 10),
  ('incubation_centre', 'startup_stages_supported', 'Startup Stages Supported', 'multiselect', null, 'Startup India incubator profiles capture stage and sector orientation.', true, '["Idea stage","Validation","Early traction","Scaling"]'::jsonb, 20),
  ('incubation_centre', 'support_services', 'Support Services', 'tags', 'Mentoring, labs, market access, prototyping, legal support', null, false, '[]'::jsonb, 30),
  ('incubation_centre', 'geography_served', 'Geography Served', 'tags', 'State, region, nationwide, specific districts', null, true, '[]'::jsonb, 40),
  ('incubation_centre', 'program_duration', 'Program Duration', 'text', '6 months, 12 months, rolling', null, false, '[]'::jsonb, 50),
  ('incubation_centre', 'application_link', 'Application Link', 'url', 'https://...', null, false, '[]'::jsonb, 60),
  ('incubation_centre', 'funding_support', 'Funding Support', 'textarea', 'Grant, seed support, investor connect, none', null, false, '[]'::jsonb, 70),
  ('incubation_centre', 'facilities', 'Facilities', 'tags', 'Coworking, fab lab, test farm, maker space', null, false, '[]'::jsonb, 80),

  ('accelerator', 'thematic_areas', 'Thematic Areas', 'tags', 'Agriculture, fintech, women-led enterprise, climate', null, true, '[]'::jsonb, 10),
  ('accelerator', 'startup_stages_supported', 'Startup Stages Supported', 'multiselect', null, 'Startup India accelerator profiles also emphasize stage, program duration, and sector.', true, '["Idea stage","Validation","Early traction","Scaling"]'::jsonb, 20),
  ('accelerator', 'support_services', 'Support Services', 'tags', 'Cohort program, mentorship, investor readiness, pilots', null, false, '[]'::jsonb, 30),
  ('accelerator', 'geography_served', 'Geography Served', 'tags', 'State, region, nationwide, virtual', null, true, '[]'::jsonb, 40),
  ('accelerator', 'program_duration', 'Program Duration', 'text', '8 weeks, 16 weeks, cohort based', null, false, '[]'::jsonb, 50),
  ('accelerator', 'application_link', 'Application Link', 'url', 'https://...', null, false, '[]'::jsonb, 60),
  ('accelerator', 'cohort_frequency', 'Cohort Frequency', 'text', '2 cohorts/year, rolling', null, false, '[]'::jsonb, 70),
  ('accelerator', 'investment_range', 'Investment / Funding Range', 'text', 'Optional funding range or investment note', null, false, '[]'::jsonb, 80),

  ('institute', 'thematic_areas', 'Thematic Areas', 'tags', 'Agriculture, rural livelihoods, design, management', null, true, '[]'::jsonb, 10),
  ('institute', 'departments_or_centres', 'Departments / Centres', 'tags', 'Agribusiness centre, entrepreneurship cell, extension wing', null, false, '[]'::jsonb, 20),
  ('institute', 'geography_served', 'Geography Served', 'tags', 'Campus catchment, district, state, national', null, false, '[]'::jsonb, 30),
  ('institute', 'partnership_types', 'Partnership Types', 'tags', 'Research, training, incubation, field pilots', null, false, '[]'::jsonb, 40),
  ('institute', 'facilities', 'Facilities', 'tags', 'Labs, training halls, field station, hostel', null, false, '[]'::jsonb, 50),
  ('institute', 'student_programs', 'Student Programs', 'textarea', 'Relevant fellowships, internships, community immersion, extension', null, false, '[]'::jsonb, 60),

  ('trader_association', 'commodities_or_sectors', 'Commodities / Sectors', 'tags', 'Pulses, textiles, forest produce, retail trade', null, true, '[]'::jsonb, 10),
  ('trader_association', 'geography_served', 'Geography Served', 'tags', 'Market town, district, state', null, true, '[]'::jsonb, 20),
  ('trader_association', 'member_base', 'Member Base', 'text', 'Approximate number or profile of members', null, false, '[]'::jsonb, 30),
  ('trader_association', 'market_linkages', 'Market Linkages', 'textarea', 'Mandis, buyers, exporters, wholesalers, aggregators', null, false, '[]'::jsonb, 40),
  ('trader_association', 'key_services', 'Key Services', 'tags', 'Advocacy, buyer connection, information, logistics', null, false, '[]'::jsonb, 50),
  ('trader_association', 'registration_status', 'Registration Status', 'select', null, null, false, '["Registered","Informal","Unknown"]'::jsonb, 60),

  ('cso', 'areas_of_work', 'Areas of Work', 'tags', 'Women''s empowerment, skilling, WASH, livelihoods', null, true, '[]'::jsonb, 10),
  ('cso', 'beneficiary_groups', 'Beneficiary Groups', 'tags', 'Farmers, youth, women, artisans, tribal communities', null, false, '[]'::jsonb, 20),
  ('cso', 'geography_served', 'Geography Served', 'tags', 'Village, block, district, state', null, true, '[]'::jsonb, 30),
  ('cso', 'registration_status', 'Registration Status', 'select', null, 'NGO Darpan-style profiles often track registration and sector/work areas.', false, '["Trust","Society","Section 8","Cooperative","Informal group","Unknown"]'::jsonb, 40),
  ('cso', 'registration_number', 'Registration Number', 'text', 'Optional registration or Darpan reference', null, false, '[]'::jsonb, 50),
  ('cso', 'programs', 'Programs / Major Activities', 'textarea', 'Short summary of major activities, achievements, or best practices', null, false, '[]'::jsonb, 60),
  ('cso', 'volunteer_or_partner_needs', 'Volunteer / Partner Needs', 'textarea', 'What kind of support or partnerships are they seeking?', null, false, '[]'::jsonb, 70);

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

alter table public.ecosystem_entity_field_definitions enable row level security;

drop policy if exists "ecosystem field definitions are public" on public.ecosystem_entity_field_definitions;
create policy "ecosystem field definitions are public"
on public.ecosystem_entity_field_definitions
for select
to anon, authenticated
using (true);
