insert into public.ecosystem_entity_types (type_slug, label, entity_kind, color_hex, sort_order)
values
  ('csr_philanthropy', 'CSR / Philanthropy', 'organisation', '#c1121f', 95),
  ('environmental_expert', 'Environmental Expert', 'individual', '#3a7d44', 96)
on conflict (type_slug) do update
set
  label = excluded.label,
  entity_kind = excluded.entity_kind,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.csr_philanthropy_entities
  (like public.mentor_entities including defaults including constraints including indexes);
create table if not exists public.environmental_expert_entities
  (like public.mentor_entities including defaults including constraints including indexes);

alter table public.csr_philanthropy_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;
alter table public.environmental_expert_entities add column if not exists type_specific_data jsonb not null default '{}'::jsonb;

create index if not exists csr_philanthropy_entities_name_idx
  on public.csr_philanthropy_entities (lower(entity_name));
create index if not exists environmental_expert_entities_name_idx
  on public.environmental_expert_entities (lower(entity_name));

alter table public.csr_philanthropy_entities enable row level security;
alter table public.environmental_expert_entities enable row level security;

create policy "csr philanthropy entities are public"
on public.csr_philanthropy_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

create policy "environmental expert entities are public"
on public.environmental_expert_entities
for select
to anon, authenticated
using (approval_status = 'approved' and is_deleted = false);

insert into public.ecosystem_entity_field_definitions
  (type_slug, field_key, label, input_type, placeholder, help_text, required, options_json, sort_order)
values
  ('csr_philanthropy', 'focus_areas', 'Funding Focus Areas', 'tags', 'Livelihoods, climate resilience, women''s enterprise, skilling, regenerative agriculture', 'Use this to capture the issues, themes, or sectors the funder prioritizes.', true, '[]'::jsonb, 10),
  ('csr_philanthropy', 'geography_served', 'Geography Served', 'tags', 'States, districts, aspirational districts, nationwide', 'Important for place-based matching and funder discovery.', true, '[]'::jsonb, 20),
  ('csr_philanthropy', 'support_instruments', 'Support Instruments', 'multiselect', null, 'Capture how support is provided, not just what themes are funded.', true, '["CSR grant","Philanthropic grant","Challenge fund","Technical assistance","Employee volunteering","In-kind support","Capacity building","Blended finance / catalytic capital"]'::jsonb, 30),
  ('csr_philanthropy', 'typical_support_size', 'Typical Support Size', 'text', 'Rs 5 lakh-Rs 25 lakh, multi-year strategic support, small pilot grants', null, false, '[]'::jsonb, 40),
  ('csr_philanthropy', 'beneficiary_or_partner_focus', 'Beneficiary / Partner Focus', 'tags', 'FPOs, CSOs, SHGs, social enterprises, youth, women-led enterprises', 'Helps match organisations to the kind of implementers or beneficiaries this funder backs.', false, '[]'::jsonb, 50),
  ('csr_philanthropy', 'application_or_nomination_process', 'Application / Nomination Process', 'textarea', 'Open call, invitation only, partner referral, annual CSR planning cycle', null, false, '[]'::jsonb, 60),
  ('csr_philanthropy', 'application_link', 'Application Link', 'url', 'https://...', null, false, '[]'::jsonb, 70),
  ('csr_philanthropy', 'partnership_preferences', 'Partnership Preferences', 'tags', 'Implementation partner, research partner, monitoring partner, pilot host', null, false, '[]'::jsonb, 80),
  ('csr_philanthropy', 'reporting_or_compliance_notes', 'Reporting / Compliance Notes', 'textarea', 'FCRA eligibility, CSR Schedule VII alignment, baseline/endline requirements', null, false, '[]'::jsonb, 90),

  ('environmental_expert', 'domain_expertise', 'Domain Expertise', 'tags', 'Climate adaptation, water stewardship, waste management, biodiversity, ESG, carbon accounting', 'Capture the technical environmental domains this expert can support.', true, '[]'::jsonb, 10),
  ('environmental_expert', 'sector_experience', 'Sector Experience', 'tags', 'Agriculture, textiles, crafts, MSMEs, energy access, forestry, tourism', 'Useful when someone is strong in environmental work but only in certain sectors.', false, '[]'::jsonb, 20),
  ('environmental_expert', 'service_offerings', 'Service Offerings', 'multiselect', null, 'Describe the kind of support the expert can provide to programmes or enterprises.', true, '["Assessment / audit","Training / capacity building","Advisory / strategy","Field implementation support","Monitoring and evaluation","Research","Compliance support","Project design"]'::jsonb, 30),
  ('environmental_expert', 'years_experience', 'Years of Experience', 'number', '8', null, false, '[]'::jsonb, 40),
  ('environmental_expert', 'qualifications_or_certifications', 'Qualifications / Certifications', 'tags', 'Environmental engineering, GIS, EIA, GHG accounting, ISO 14001 auditor', null, false, '[]'::jsonb, 50),
  ('environmental_expert', 'languages_spoken', 'Languages Spoken', 'tags', 'Hindi, English, Marathi', null, false, '[]'::jsonb, 60),
  ('environmental_expert', 'geography_served', 'Geography Served', 'tags', 'Districts, states, regions, nationwide, remote', 'Capture where the expert can work physically or remotely.', true, '[]'::jsonb, 70),
  ('environmental_expert', 'engagement_modes', 'Engagement Modes', 'multiselect', null, null, false, '["In person","Remote","Hybrid","Short assignment","Retainer","Project based"]'::jsonb, 80),
  ('environmental_expert', 'availability_notes', 'Availability Notes', 'textarea', 'Consulting availability, field travel constraints, preferred engagement duration', null, false, '[]'::jsonb, 90)
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
select 'environmental_expert'::text, t.label, t.entity_kind, t.color_hex, e.* from public.environmental_expert_entities e join public.ecosystem_entity_types t on t.type_slug = 'environmental_expert';

create or replace view public.ecosystem_directory_entities as
select *
from public.ecosystem_directory_entities_all
where approval_status = 'approved'
  and is_deleted = false;
