// Must run before server modules are imported so db.js sees the test
// configuration. dotenv will not override already-set variables, so explicit
// environment variables (e.g. CI secrets) always win.

process.env.PGSEARCHPATH = process.env.PGSEARCHPATH ?? 'test'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/basud_db'
}
