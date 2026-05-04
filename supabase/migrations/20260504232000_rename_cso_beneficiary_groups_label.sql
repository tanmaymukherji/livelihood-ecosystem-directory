update public.ecosystem_entity_field_definitions
set
  label = 'Target Groups',
  updated_at = now()
where type_slug = 'cso'
  and field_key = 'beneficiary_groups';
