# Livelihood Ecosystem Directory

Static GitHub Pages directory for discovering local ecosystem actors such as mentors, community stewards, volunteers, interns, incubation centres, accelerators, institutes, trader associations, and CSOs.

Project folder:
`C:\github\livelihood-ecosystem-directory`

Included app surfaces:
- Public search page: `index.html`
- Entity detail page: `entity-detail.html`
- Admin review and editing page: `admin.html`
- Shared Supabase loader: `ecosystem-store.js`
- Supabase migration: `supabase/migrations/20260428110000_create_livelihood_ecosystem_directory.sql`
- Supabase edge function: `supabase/functions/livelihood-ecosystem-admin/index.ts`
- CSV upload template: `data/bulk-upload-template.csv`

What this app supports:
- Public keyword and place search across approved entities
- Multi-select entity-type filtering with color-coded MapmyIndia markers
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
