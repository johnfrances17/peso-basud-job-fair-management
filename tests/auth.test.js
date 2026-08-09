import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../server/app.js'
import { TEST_DB_NAME } from './global-setup.js'

function validToken() {
  return request(app)
    .post('/api/auth/login')
    .send({ email: 'staff@basud.local', password: 'Basud1234' })
}

describe('POST /api/auth/login', () => {
  it('signs in an active staff account and returns a signed token', async () => {
    const response = await validToken()

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Signed in successfully.')
    expect(response.body.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(response.body.staff).toEqual({
      email: 'staff@basud.local',
      displayName: 'Basud Staff',
      role: 'staff',
    })
  })

  it('rejects a wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@basud.local', password: 'WrongPass1' })

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Invalid staff credentials.')
  })

  it('rejects an unknown email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@basud.local', password: 'Basud1234' })

    expect(response.status).toBe(401)
  })

  it('rejects an inactive account', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@basud.local', password: 'Basud1234' })

    expect(response.status).toBe(401)
  })

  it('rejects missing credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'staff@basud.local' })

    expect(response.status).toBe(400)
  })

  it('upgrades a legacy plaintext password to a bcrypt hash on login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'legacy@basud.local', password: 'LegacyPass1' })

    expect(response.status).toBe(200)
    expect(response.body.token).toBeTruthy()

    const mysql = (await import('mysql2/promise')).default
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: TEST_DB_NAME,
    })

    const [rows] = await connection.query(
      'SELECT password_hash FROM staff_accounts WHERE email = ?',
      ['legacy@basud.local'],
    )
    await connection.end()

    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the staff session for a valid token', async () => {
    const login = await validToken()

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(response.status).toBe(200)
    expect(response.body.staff.email).toBe('staff@basud.local')
  })

  it('rejects a missing token', async () => {
    const response = await request(app).get('/api/auth/me')

    expect(response.status).toBe(401)
  })
})

describe('staff token verification', () => {
  it('rejects an unsigned (forged) token on protected routes', async () => {
    const forgedBody = Buffer.from(`staff@basud.local:staff:${Date.now() + 60_000}`).toString('base64url')

    const response = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${forgedBody}`)

    expect(response.status).toBe(401)
  })

  it('rejects a token with a tampered signature', async () => {
    const login = await validToken()
    const [body, signature] = login.body.token.split('.')
    const tamperedSignature = signature.startsWith('A') ? `B${signature.slice(1)}` : `A${signature.slice(1)}`

    const response = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${body}.${tamperedSignature}`)

    expect(response.status).toBe(401)
  })

  it('rejects a token with tampered payload', async () => {
    const login = await validToken()
    const [, signature] = login.body.token.split('.')
    const evilBody = Buffer.from('admin@basud.local:staff:9999999999999').toString('base64url')

    const response = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${evilBody}.${signature}`)

    expect(response.status).toBe(401)
  })
})
