import 'dotenv/config'
import pg from 'pg'

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:5432/basud_db'

// Supabase (and the local test harness) require TLS for remote Postgres.
// Node-postgres refuses TLS by default, so opt in when not running against a
// bare local server.
const requiresSsl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /supabase\.(co|com)/.test(connectionString)

// Emulate mysql2's `dateStrings: true` so the API keeps returning
// 'YYYY-MM-DD' / ISO timestamps instead of JS Date objects. This keeps the
// frontend formatting and the Excel export stable.
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
  // Tests pin a dedicated schema (see tests/setup-env.js) so they never touch
  // production data. Omitted in dev/prod, keeping the default public schema.
  options: process.env.PGSEARCHPATH ? `-c search_path=${process.env.PGSEARCHPATH}` : undefined,
})

export default pool
