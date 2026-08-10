# PESO Basud Job Fair Management

Member registration and management system for the PESO (Public Employment Service Office) Basud job fair.

## Stack

- **Frontend** — Vite + React (Tailwind CSS via `src/index.css`, page layout in `src/App.css`)
- **Backend** — Express API (`server/`), serverless entry point at `api/index.js`
- **Database** — Supabase Postgres; canonical schema in `database/schema.sql`
- **File storage** — Supabase Storage bucket `member_documents` (private; created by `database/migrations/002_document_attachments.sql`)
- **Deployment** — Vercel (`vercel.json` routes `/api/*` to the serverless function, everything else to the SPA)
- **CI** — GitHub Actions (`.github/workflows/ci.yml`): lint, build, test

## Environment variables by platform

Local: copy `.env.example` to `.env` and fill in (the example now defaults to
Supabase pooled connection details).

Vercel (project Settings -> Environment Variables) — set these or the API breaks:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase pooled connection string (port 6543) |
| `DATABASE_SSL` | Yes | `true` for Supabase |
| `AUTH_SECRET` | Yes | Long random string. Without it sessions reset on every cold start and staff get logged out |
| `SUPABASE_URL` | Attachments | Only needed for document uploads/downloads |
| `SUPABASE_SERVICE_ROLE_KEY` | Attachments | Service role key; backend only, never commit it |
| `ALLOWED_ORIGINS` | No | Only for cross-origin API calls; `https://*.vercel.app` wildcards supported |

GitHub (repo Settings -> Secrets and variables -> Actions) — one secret:

| Secret | Notes |
| --- | --- |
| `TEST_DATABASE_URL` | Connection string used by CI. The shared Supabase project works: tests isolate all data in a dedicated `test` schema and never touch `public` data |

## Local development

1. Install dependencies: `npm install`
2. Create `.env` from `.env.example` and fill in the Supabase pooled `DATABASE_URL` (the example ships with `DATABASE_SSL=true` and placeholders)
3. Run the API: `npm run server` (Express on `http://localhost:3001`)
4. Run the frontend: `npm run dev` (Vite proxies `/api` to the API server)

## Database

`database/schema.sql` is the canonical schema. It creates all tables, enables RLS (deny-all for anon/authenticated roles — the app connects as the postgres role, which bypasses RLS), and seeds the PESO admin account.

> **Warning:** `schema.sql` is a full reset script — it DROPs and recreates every table. Run it only on a fresh Supabase project. Never run it against the live database; incremental changes belong in `database/migrations/`.

To (re)create the schema on a fresh Supabase project, paste `database/schema.sql` into the SQL editor. The test suite recreates it automatically inside an isolated `test` schema.

### Staff login

Seeded in `database/schema.sql`:

- Email: `pesoadmin@gmail.com`
- Password: `pesoadmin121314`

Passwords are stored as bcrypt hashes (10 rounds). To change the admin password, update `password_hash` in the `staff_accounts` table and regenerate the hash with:

```
node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD', 10))"
```

## Tests

`npm test` runs the Vitest suite (validation, duplicate detection, documents, formatting, sorting). Tests reuse `DATABASE_URL` (or `TEST_DATABASE_URL` if set) and isolate all data in a dedicated `test` schema — safe on the shared Supabase project, since `public` data is untouched. On CI, `TEST_DATABASE_URL` comes from the GitHub repository secret.

## API

All `/api` endpoints require a staff session token (`Authorization: Bearer <token>`), issued by `POST /api/auth/login`:

- `GET /api/health` — health check
- `POST /api/auth/login` — staff login
- `GET /api/auth/me` — current staff session
- `POST /api/auth/change-password` — change staff password
- `GET /api/members` — list members
- `POST /api/members` — create member (409 if an exact duplicate already exists)
- `GET /api/members/:id` — single member
- `PUT /api/members/:id` — update member
- `DELETE /api/members/:id` — delete member (cascades child rows and removes storage files)
- `GET /api/members/:id/documents` — list document attachments
- `POST /api/members/:id/documents` — upload document attachment (edit mode only)
- `GET /api/members/:id/documents/:attachmentId/download` — download attachment
- `DELETE /api/members/:id/documents/:attachmentId` — delete attachment
