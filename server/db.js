import 'dotenv/config'
import pg from 'pg'

// This stack runs on Supabase Postgres only (the XAMPP/MySQL era is gone).
// A silent localhost fallback would only mask a missing DATABASE_URL (e.g. an
// unset Vercel environment variable) behind a confusing connection error, so
// production fails fast with an actionable message. Local dev and the test
// suite may still fall back to a bare local Postgres.
const DEFAULT_LOCAL_URL = 'postgres://postgres:postgres@127.0.0.1:5432/basud_db'

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error(
    'DATABASE_URL is not set. Configure it in the Vercel project settings ' +
      '(Supabase pooled connection string, port 6543).',
  )
}

const connectionString = process.env.DATABASE_URL ?? DEFAULT_LOCAL_URL

if (!process.env.DATABASE_URL) {
  console.warn(`[db] DATABASE_URL not set — falling back to local Postgres (${DEFAULT_LOCAL_URL})`)
}

// Supabase (and the local test harness) require TLS for remote Postgres.
// Node-postgres refuses TLS by default, so opt in when not running against a
// bare local server.
const requiresSsl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /supabase\.(co|com)/.test(connectionString)

// Return DATE/TIMESTAMP columns as plain strings ('YYYY-MM-DD' / ISO) instead
// of JS Date objects, keeping the frontend formatting and Excel export stable
// (behavior inherited from the original mysql2 `dateStrings: true` config).
const DATE_OID = 1082
const TIMESTAMPTZ_OID = 1184
const TIMESTAMP_OID = 1114

function toDateOnly(value) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return value
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value
}

pg.types.setTypeParser(DATE_OID, toDateOnly)
pg.types.setTypeParser(TIMESTAMPTZ_OID, toIsoString)
pg.types.setTypeParser(TIMESTAMP_OID, toIsoString)

const pool = new pg.Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // NOTE: no search_path options here. Schemas are chosen explicitly per
  // query (see DB_SCHEMA in queries.js / app.js), so a test connection can
  // never leak its schema into shared pooled backends.
})

export default pool
