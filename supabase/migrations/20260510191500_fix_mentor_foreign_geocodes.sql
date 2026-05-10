update public.mentor_entities
set
  latitude = 22.3511148,
  longitude = 78.6677428,
  updated_at = now()
where entity_uid in (
  'mentor-dr-v-k-arora-6ae628b9',
  'mentor-nikhil-sharma-d2489bf9',
  'mentor-anupam-saronwala-d87b8fe2',
  'mentor-digvijay-singh-b6aa0ce9',
  'mentor-aditya-arora-38b6c9dd',
  'mentor-himanshu-sharma-24b8e6ff',
  'mentor-abhishek-kumar-57740ba5',
  'mentor-amit-singhal-3515d8c5'
);
