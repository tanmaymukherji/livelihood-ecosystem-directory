insert into public.ecosystem_entity_field_definitions
  (type_slug, field_key, label, input_type, placeholder, help_text, required, options_json, sort_order)
values
  ('place', 'place_kind', 'Place Type', 'select', null, 'Choose the exact administrative or settlement level at which this place record is being maintained.', true, '["Village","Gram Panchayat","Block","District","State"]'::jsonb, 10),
  ('place', 'village_name', 'Village', 'text', 'Village or habitation name', 'Most place records will be captured at village level, so keep this whenever relevant.', false, '[]'::jsonb, 20),
  ('place', 'gram_panchayat_name', 'Gram Panchayat', 'text', 'Gram Panchayat name', 'Important when data is aggregated above a village but below a block.', false, '[]'::jsonb, 30),
  ('place', 'block_name', 'Block / Taluk / Tehsil', 'text', 'Block, taluk, or tehsil name', null, false, '[]'::jsonb, 40),
  ('place', 'district_name', 'District', 'text', 'District name', null, true, '[]'::jsonb, 50),
  ('place', 'state_name', 'State', 'text', 'State name', null, true, '[]'::jsonb, 60),
  ('place', 'postal_code', 'Postal Code', 'text', 'Optional postal or PIN code', null, false, '[]'::jsonb, 70),
  ('place', 'location_notes', 'Location Notes', 'textarea', 'Boundary note, hamlet coverage, local alias, or aggregation note', 'Use this to explain whether the data is village-level, panchayat-level, or block-level and any local naming nuance.', false, '[]'::jsonb, 80)
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

delete from public.ecosystem_entity_field_definitions
where type_slug = 'place'
  and field_key in ('town_name');
