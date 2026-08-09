import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const AUTH_TOKEN_LIFETIME_MS = 1000 * 60 * 60 * 12
const BCRYPT_ROUNDS = 10

// Ephemeral fallback keeps local dev working, but sessions stop being valid
// after a restart. Set AUTH_SECRET in .env for production deployments.
const authSecret = process.env.AUTH_SECRET?.trim() || crypto.randomBytes(32).toString('hex')

export function requireStaffAuth(request, response, next) {
  const session = verifyStaffToken(readBearerToken(request))

  if (!session) {
    response.status(401).json({ message: 'Unauthorized' })
    return
  }

  request.staffSession = session
  next()
}

export function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value)
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password ?? ''), BCRYPT_ROUNDS)
}

export async function verifyPassword(password, storedHash) {
  const candidate = String(password ?? '')

  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(candidate, storedHash)
  }

  // Legacy plaintext records (pre-hashing). Caller is expected to rehash.
  return candidate === storedHash
}

function signTokenBody(body) {
  return crypto.createHmac('sha256', authSecret).update(body).digest('base64url')
}

export function createStaffToken(staff) {
  const expiresAt = Date.now() + AUTH_TOKEN_LIFETIME_MS
  const payload = `${staff.email}:${staff.role}:${expiresAt}`
  const body = Buffer.from(payload).toString('base64url')
  const signature = signTokenBody(body)
  return `${body}.${signature}`
}

export function readBearerToken(request) {
  const header = request.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' ? token ?? '' : ''
}

export function verifyStaffToken(token) {
  if (!token) {
    return null
  }

  const separator = token.lastIndexOf('.')
  if (separator <= 0) {
    return null
  }

  const body = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const expectedSignature = signTokenBody(body)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
  }

  let payload = ''

  try {
    payload = Buffer.from(body, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const [email, role, expiresAtRaw] = payload.split(':')
  const expiresAt = Number(expiresAtRaw)

  if (!email || role !== 'staff' || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null
  }

  return { email, expiresAt }
}
