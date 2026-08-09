# PESO Basud Job Fair Management

Member registration and management system for the PESO (Public Employment Service Office) Basud job fair.

## Stack

- **Frontend** — Vite + React (Tailwind CSS via `src/index.css`, page layout in `src/App.css`)
- **Backend** — Express API (`server/`), serverless entry point at `api/index.js`
- **Database** — Supabase Postgres; canonical schema in `database/schema.sql`
- **File storage** — Supabase Storage bucket `member_documents` (private; created by `database/migrations/002_document_attachments.sql`)
- **Deployment** — Vercel (`vercel.json` routes `/api/*` to the serverless function, everything else to the SPA)
- **CI** — GitHub Actions (`.github/workflows/ci.yml`): lint, build, test

## Local development

1. Install dependencies: `npm install`
2. Create `.env` from `.env.example` and fill in:
   - `DATABASE_URL` — Supabase pooled connection string
   - `DATABASE_SSL=true` for remote managed Postgres
   - `AUTH_SECRET` — long random string for staff session tokens
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — required only for document attachments (backend only, never commit the service role key)
3. Run the API: `npm run server` (Express on `http://localhost:3001`)
4. Run the frontend: `npm run dev` (Vite proxies `/api` to the API server)

## Database

Apply `database/schema.sql` to the Supabase project via the SQL editor (or run it once per test schema automatically). It creates all tables, enables RLS (deny-all for anon/authenticated roles — the app connects as the postgres role, which bypasses RLS), and seeds the PESO admin account.

### Staff login

Seeded in `database/schema.sql`:

- Email: `pesoadmin@gmail.com`
- Password: `pesoadmin121314`

Passwords are stored as bcrypt hashes (10 rounds). To change the admin password, update `password_hash` in the `staff_accounts` table and regenerate the hash with:

```
node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD', 10))"
```

## Tests

`npm test` runs the Vitest suite (validation, duplicate detection, documents, formatting, sorting). Tests isolate data in a dedicated `test` schema and need either a local Postgres (`postgres://postgres:postgres@127.0.0.1:5432/basud_db`) or a remote one via `TEST_DATABASE_URL`.

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
