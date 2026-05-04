insert into public.place_role_types (slug, label, sort_order, is_system) values
  ('csr_philanthropy', 'CSR / Philanthropy', 145, true),
  ('environmental_expert', 'Environmental Expert', 146, true),
  ('story_tellers', 'Story Tellers', 147, true)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    updated_at = now();
