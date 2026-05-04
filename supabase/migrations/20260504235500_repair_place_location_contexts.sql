update public.place_initiative_locations
set
  location_name = 'Podha',
  display_label = 'Podha, Jharkhand',
  state_name = 'Jharkhand',
  village_name = 'Podha',
  updated_at = now()
where place_uid = 'place-jharkhand-pradan-576d5d56'
  and lower(coalesce(display_label, '')) = 'podha, jharkhand';

update public.place_initiative_locations
set
  location_name = 'Rocho',
  display_label = 'Rocho, Jharkhand',
  state_name = 'Jharkhand',
  village_name = 'Rocho',
  updated_at = now()
where place_uid = 'place-jharkhand-pradan-576d5d56'
  and lower(coalesce(display_label, '')) = 'rocho, jharkhand';

update public.place_initiative_locations
set
  display_label = 'Pandharpur, Solapur, Maharashtra',
  state_name = 'Maharashtra',
  district_name = 'Solapur',
  updated_at = now()
where place_uid = 'place-pandharpur-fb4f4f4b'
  and lower(coalesce(location_name, '')) = 'pandharpur';
