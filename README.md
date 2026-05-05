# Livelihood Ecosystem Directory

Static GitHub Pages directory for discovering local ecosystem actors such as mentors, community stewards, volunteers, interns, incubation centres, accelerators, institutes, trader associations, and CSOs.

Project folder:
`C:\github\livelihood-ecosystem-directory`

Included app surfaces:
- Public search page: `index.html`
- Public place initiative page: `place-initiatives.html`
- Entity detail page: `entity-detail.html`
- Admin review and editing page: `admin.html`
- Shared Supabase loader: `ecosystem-store.js`
- Supabase migration: `supabase/migrations/20260428110000_create_livelihood_ecosystem_directory.sql`
- Supabase edge function: `supabase/functions/livelihood-ecosystem-admin/index.ts`
- CSV upload template: `data/bulk-upload-template.csv`

What this app supports:
- Public keyword and place search across approved entities
- Multi-select entity-type filtering with color-coded MapmyIndia markers
- Public place initiative map with a large India map, a scrollable place editor, bottom detail strip, role callouts, print view, and admin-gated editing
- Public submission form for new entries, routed to admin approval
- Detail page for every approved entity
- Admin search, edit, approve, reject, and delete workflows
- Bulk CSV upload into Supabase from the admin panel
- Edit/delete requests stored in Supabase and emailed to `tanmay@greenruraleconomy.in` when email secrets are configured

Deployment:
- GitHub Pages deploys from `.github/workflows/deploy-pages.yml`
- Static frontend reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `MAPMYINDIA_MAP_KEY` from `config.js`

Backend setup notes:
- Run the migration in `supabase/migrations`
- The place initiative page also needs `supabase/migrations/20260503120000_create_place_initiatives.sql`
- The LGD-backed place lookup also needs `supabase/migrations/20260505153000_create_lgd_geography_directory.sql`
- Fast place-partner recall also needs `supabase/migrations/20260505170000_add_place_partner_match_cache.sql`
- Deploy the `livelihood-ecosystem-admin` edge function
- Set function secrets for:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ECOSYSTEM_ADMIN_EMAIL` default `tanmay@greenruraleconomy.in`
  - `RESEND_API_KEY` optional, only if you want live email notifications
  - `RESEND_FROM_EMAIL` optional, defaults to `tanmay@greenruraleconomy.in`

Admin password bootstrap:
- After running the migration, set an admin password with:
`select public.ecosystem_set_admin_password('replace-with-a-strong-password');`

LGD place lookup deploy notes:
- The place initiative editor now searches the public Supabase view `public.lgd_geography_directory_public` first, then falls back to the committed static bucket files in `data/lgd/` if Supabase search is unavailable or the runtime table has not been seeded yet.
- Rebuild the committed fallback dataset when refreshing LGD source data with:
`node scripts/build-lgd-geography.mjs`
- For local Supabase or SQL-first deployments, seed the runtime table after the LGD migration with:
`psql "$SUPABASE_DB_URL" -f data/lgd/seed.sql`
- For hosted REST imports, seed the runtime table with:
`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-lgd-to-supabase.mjs --reset`
- The importer writes resumable progress to `data/lgd/import-progress.json`; delete that file only if you want to restart from the beginning after a partial run.
- Commit the refreshed `data/lgd/manifest.json` and `data/lgd/buckets/*.json` alongside any LGD runtime refresh so GitHub Pages fallback autocomplete stays in sync with the Supabase table.

Place partner match cache notes:
- Place pin detail now prefers precomputed Supabase cache rows from `public.place_partner_match_cache_public` instead of rebuilding the need-to-provider mapping on every click in the browser.
- The cache refreshes automatically after place initiative saves and place thematic need create, update, or delete actions.
- If provider records change in the master directory and you want to refresh every place against the latest provider pool, use the Admin Sync panel on `place-initiatives.html` and run `Sync All Places`.
