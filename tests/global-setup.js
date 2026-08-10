import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'

// Tests run against a dedicated schema on the same Postgres server as the app
// (or a local instance), so they never touch production data. queries.js and
// app.js qualify every table with DB_SCHEMA (set in setup-env.js); this setup
// script creates that schema and loads the schema.sql definitions into it.
//
// CI assigns a per-run schema (DB_SCHEMA=test_<run_id>) so concurrent runs on
// the shared Supabase database cannot drop each other's schema mid-test; the
// teardown below drops the schema again so the database stays clean.
export const TEST_SCHEMA = process.env.DB_SCHEMA ?? 'test'

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

function requiresSsl(value) {
  return process.env.DATABASE_SSL === 'true' || /supabase\.(co|com)/.test(value ?? '')
}

export default async function globalSetup() {
  const client = new pg.Client({
    connectionString,
    ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  })

  await client.connect()

  await client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`)
  await client.query(`CREATE SCHEMA ${TEST_SCHEMA}`)
  await client.query(`SET search_path TO ${TEST_SCHEMA}`)

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql')
  const schemaSql = await readFile(schemaPath, 'utf8')
  await client.query(schemaSql)

  // Staff accounts used by the auth tests. bcrypt rounds kept low for speed.
  const passwordHash = await bcrypt.hash('Basud1234', 4)
  const legacyPlaintext = 'LegacyPass1'

  await client.query(
    `INSERT INTO staff_accounts (email, password_hash, display_name, role, account_status)
     VALUES ($1, $2, 'Basud Staff', 'staff', 'Active'),
            ($3, $2, 'Inactive Staff', 'staff', 'Inactive'),
            ($4, $5, 'Legacy Staff', 'staff', 'Active')`,
    ['staff@basud.local', passwordHash, 'inactive@basud.local', 'legacy@basud.local', legacyPlaintext],
  )

  await client.end()

  return async () => {
    const teardownClient = new pg.Client({
      connectionString,
      ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    })
    await teardownClient.connect()
    await teardownClient.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`)
    await teardownClient.end()
  }
}
