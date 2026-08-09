// Must run before server modules are imported so db.js sees the test
// configuration. dotenv will not override already-set variables, so explicit
// environment variables (e.g. CI secrets) always win.

// Tests run against a dedicated schema. Every query built by queries.js and
// app.js is explicitly qualified with this schema (no search_path reliance).
process.env.DB_SCHEMA = process.env.DB_SCHEMA ?? 'test'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/basud_db'
}
