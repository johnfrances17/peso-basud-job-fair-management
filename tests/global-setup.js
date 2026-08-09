import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

export const TEST_DB_NAME = 'basud_db_test'

const rootConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
}

export default async function globalSetup() {
  const connection = await mysql.createConnection(rootConfig)

  await connection.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`)
  await connection.query(`CREATE DATABASE ${TEST_DB_NAME}`)

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const schemaPath = path.resolve(__dirname, '..', 'database', 'basud_db.sql')
  const schemaSql = (await readFile(schemaPath, 'utf8')).replaceAll('basud_db', TEST_DB_NAME)
  await connection.query(schemaSql)

  // Staff accounts used by the auth tests. bcrypt rounds kept low for speed.
  const passwordHash = await bcrypt.hash('Basud1234', 4)
  const legacyPlaintext = 'LegacyPass1'

  await connection.query(
    `INSERT INTO ${TEST_DB_NAME}.staff_accounts
      (email, password_hash, display_name, role, account_status)
      VALUES (?, ?, 'Basud Staff', 'staff', 'Active'), (?, ?, 'Inactive Staff', 'staff', 'Inactive'), (?, ?, 'Legacy Staff', 'staff', 'Active')`,
    ['staff@basud.local', passwordHash, 'inactive@basud.local', passwordHash, 'legacy@basud.local', legacyPlaintext],
  )

  await connection.end()
}
