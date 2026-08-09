import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import pool from './db.js'
import {
  createStaffToken,
  hashPassword,
  isBcryptHash,
  requireStaffAuth,
  verifyPassword,
} from './auth.js'
import { getChildTableInfo, SINGLE_ROW_KEYS } from './queries.js'
import { deleteAttachment, downloadAttachment, uploadAttachment } from './storage.js'

const app = express()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const specialCategoryMap = {
  fourPsBeneficiary: '4ps',
  indigenousPeople: 'indigenous_people',
  soloParent: 'solo_parent',
  seniorCitizen: 'senior_citizen',
  returningOfw: 'returning_ofw',
}

const documentFields = ['resumeAttached', 'validIdAttached', 'certificateAttached', 'otherDocumentsAttached']

// Digital attachment constraints (multipart uploads).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const allowedDocumentTypes = new Set(['resume', 'valid_id', 'certificate', 'other'])
// mime type -> accepted file extensions
const allowedFileTypes = new Map([
  ['image/jpeg', ['jpg', 'jpeg']],
  ['image/png', ['png']],
  ['image/webp', ['webp']],
  ['image/gif', ['gif']],
  ['application/pdf', ['pdf']],
  ['application/msword', ['doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['docx']],
  ['application/vnd.ms-excel', ['xls']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['xlsx']],
  ['text/plain', ['txt']],
])

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
})

function serializeAttachment(row) {
  return {
    id: row.id,
    documentType: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  }
}

function attachmentSelectSql() {
  return `SELECT id, document_type, file_name, storage_path, mime_type, file_size, uploaded_by, created_at
    FROM document_attachments`
}

const sexValues = new Set(['M', 'F'])
const civilStatusValues = new Set(['Single', 'Married', 'Widowed', 'Separated'])
const willingToWorkValues = new Set([
  'Within Municipality',
  'Within Province',
  'Anywhere in the Philippines',
  'Overseas',
])

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function isOriginAllowed(origin) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true
  }
  // Entries like "https://*.vercel.app" match any subdomain (Vercel previews).
  return allowedOrigins.some((entry) => {
    const wildcardIndex = entry.indexOf('*')
    if (wildcardIndex === -1) {
      return false
    }
    return origin.length > entry.length - 1 && origin.endsWith(entry.slice(wildcardIndex + 1))
  })
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true)
        return
      }

      const error = new Error('Origin not allowed by CORS')
      error.status = 403
      callback(error)
    },
  }),
)
app.use(express.json())

// Simple request logging middleware.
app.use((request, response, next) => {
  const startedAt = Date.now()
  response.on('finish', () => {
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
    )
  })
  next()
})

class InputError extends Error {
  status = 400
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function toNull(value) {
  if (value === '' || value === undefined || value === null) {
    return null
  }
  return value
}

function toIntOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number.parseInt(value, 10)
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function toDateValue(value) {
  if (value instanceof Date || (typeof value === 'string' && value.includes('T'))) {
    return value
  }
  return value ? String(value).slice(0, 10) : null
}

function toMemberId(rawValue) {
  if (!/^\d+$/.test(String(rawValue))) {
    return null
  }
  return Number.parseInt(rawValue, 10)
}

// ---------------------------------------------------------------------------
// Member validation
// ---------------------------------------------------------------------------

function validateMember(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new InputError('Request body must be a member object.')
  }

  const personal = payload.personal ?? {}
  if (typeof personal !== 'object' || !String(personal.lastName ?? '').trim()) {
    throw new InputError('Last name is required.')
  }
  if (typeof personal !== 'object' || !String(personal.firstName ?? '').trim()) {
    throw new InputError('First name is required.')
  }
  if (!sexValues.has(personal.sex)) {
    throw new InputError('Invalid sex value. Allowed values: M, F.')
  }
  if (!civilStatusValues.has(personal.civilStatus)) {
    throw new InputError('Invalid civil status value.')
  }

  const willingToWork = payload.eligibility?.willingToWork
  if (willingToWork !== undefined) {
    if (!Array.isArray(willingToWork) || willingToWork.some((scope) => !willingToWorkValues.has(scope))) {
      throw new InputError('Invalid willing-to-work scope.')
    }
  }
}

// ---------------------------------------------------------------------------
// Normalization (API payload section -> DB column values)
// ---------------------------------------------------------------------------

function normalizeSectionValue(key, field, value) {
  if (key === 'documents' && documentFields.includes(field)) {
    return toBoolean(value)
  }
  if (key === 'personal' && field === 'dateOfBirth') {
    return toDateValue(value)
  }
  if (key === 'personal' && field === 'age') {
    return toIntOrNull(value)
  }
  if (key === 'employment' && field === 'yearsOfExperience') {
    return toNull(value)
  }
  return toNull(value)
}

function singleRowInsert(key, memberId, payload) {
  const { table, columns } = getChildTableInfo(key)
  const section = payload[key] ?? {}
  const values = columns.map(([, field]) => normalizeSectionValue(key, field, section[field]))
  const columnNames = columns.map(([column]) => column)
  const placeholders = columns.map((_, index) => `$${index + 2}`)
  const sql = `INSERT INTO ${table} (member_id, ${columnNames.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`
  return { sql, params: [memberId, ...values] }
}

function singleRowUpsert(key, memberId, payload) {
  const { table, columns } = getChildTableInfo(key)
  const section = payload[key] ?? {}
  const values = columns.map(([, field]) => normalizeSectionValue(key, field, section[field]))
  const columnNames = columns.map(([column]) => column)
  const placeholders = columns.map((_, index) => `$${index + 2}`)
  const sql = `INSERT INTO ${table} (member_id, ${columnNames.join(', ')})
    VALUES ($1, ${placeholders.join(', ')})
    ON CONFLICT (member_id) DO UPDATE SET
      ${columns.map(([column]) => `${column} = EXCLUDED.${column}`).join(', ')}`
  return { sql, params: [memberId, ...values] }
}

const ADDRESS_COLUMNS = [
  'same_as_current',
  'house_no_street',
  'barangay',
  'municipality_city',
  'province',
  'zip_code',
]

function addressParams(memberId, addressType, address) {
  return [
    memberId,
    addressType,
    toBoolean(address?.sameAsCurrent ?? false),
    toNull(address?.houseNoStreet),
    toNull(address?.barangay),
    toNull(address?.municipalityCity),
    toNull(address?.province),
    toNull(address?.zipCode),
  ]
}

function addressInsertSql() {
  return `INSERT INTO member_addresses (member_id, address_type, ${ADDRESS_COLUMNS.join(', ')})
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
}

function addressUpsertSql() {
  return `INSERT INTO member_addresses (member_id, address_type, ${ADDRESS_COLUMNS.join(', ')})
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (member_id, address_type) DO UPDATE SET
      ${ADDRESS_COLUMNS.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`
}

function normalizeAddresses(payload) {
  const current = payload.currentAddress ?? {}
  const permanentRaw = payload.permanentAddress ?? {}
  const sameAsCurrent = toBoolean(permanentRaw.sameAsCurrent)

  return {
    current,
    permanent: sameAsCurrent ? { ...current, sameAsCurrent: true } : { ...permanentRaw, sameAsCurrent: false },
  }
}

// ---------------------------------------------------------------------------
// Member hydration (DB rows -> API member object)
// ---------------------------------------------------------------------------

const childSelects = [
  { table: 'member_personal_information', key: 'personal' },
  { table: 'member_contact_information', key: 'contact' },
  { table: 'member_government_information', key: 'government' },
  { table: 'member_employment_eligibility', key: 'eligibility' },
  { table: 'member_pwd_information', key: 'pwd' },
  { table: 'member_emergency_contacts', key: 'emergency' },
  { table: 'member_educational_background', key: 'education' },
  { table: 'member_employment_information', key: 'employment' },
  { table: 'member_skills', key: 'skills' },
  { table: 'member_documents', key: 'documents' },
  { table: 'member_addresses', key: 'addresses' },
  { table: 'member_willing_to_work', key: 'willingToWork' },
  { table: 'member_special_categories', key: 'specialCategories' },
]

function mapCamel(row, pairs) {
  return pairs.reduce((acc, [column, field]) => {
    acc[field] = row[column]
    return acc
  }, {})
}

function hydrateMember(memberRow, rowsByTable) {
  const getRow = (table) => rowsByTable[table]?.find((row) => row.member_id === memberRow.id)

  const personalRow = getRow('member_personal_information')
  const contactRow = getRow('member_contact_information')
  const governmentRow = getRow('member_government_information')
  const eligibilityRow = getRow('member_employment_eligibility')
  const pwdRow = getRow('member_pwd_information')
  const emergencyRow = getRow('member_emergency_contacts')
  const educationRow = getRow('member_educational_background')
  const employmentRow = getRow('member_employment_information')
  const skillsRow = getRow('member_skills')
  const documentsRow = getRow('member_documents')

  const addressRows = (rowsByTable['member_addresses'] ?? []).filter((row) => row.member_id === memberRow.id)
  const currentAddressRow = addressRows.find((row) => row.address_type === 'current')
  const permanentAddressRow = addressRows.find((row) => row.address_type === 'permanent')

  const willingToWorkRows = (rowsByTable['member_willing_to_work'] ?? []).filter(
    (row) => row.member_id === memberRow.id,
  )
  const specialCategoryRows = (rowsByTable['member_special_categories'] ?? []).filter(
    (row) => row.member_id === memberRow.id,
  )
  const specialCategoryCodesForMember = new Set(specialCategoryRows.map((row) => row.category_code))

  const mapAddress = (row) => mapCamel(row, [
    ['house_no_street', 'houseNoStreet'],
    ['barangay', 'barangay'],
    ['municipality_city', 'municipalityCity'],
    ['province', 'province'],
    ['zip_code', 'zipCode'],
  ])

  return {
    id: memberRow.id,
    createdAt: memberRow.created_at,
    updatedAt: memberRow.updated_at,
    personal: personalRow
      ? mapCamel(personalRow, [
          ['last_name', 'lastName'],
          ['first_name', 'firstName'],
          ['middle_name', 'middleName'],
          ['suffix', 'suffix'],
          ['sex', 'sex'],
          ['date_of_birth', 'dateOfBirth'],
          ['place_of_birth', 'placeOfBirth'],
          ['age', 'age'],
          ['civil_status', 'civilStatus'],
          ['nationality', 'nationality'],
          ['religion', 'religion'],
        ])
      : {},
    contact: contactRow
      ? mapCamel(contactRow, [
          ['mobile_number', 'mobileNumber'],
          ['email_address', 'emailAddress'],
          ['facebook_profile', 'facebookProfile'],
        ])
      : {},
    currentAddress: currentAddressRow ? mapAddress(currentAddressRow) : {},
    permanentAddress: permanentAddressRow
      ? { sameAsCurrent: permanentAddressRow.same_as_current, ...mapAddress(permanentAddressRow) }
      : { sameAsCurrent: true },
    government: governmentRow
      ? mapCamel(governmentRow, [
          ['philsys_national_id_number', 'philSysNationalIdNumber'],
          ['sss_number', 'sssNumber'],
          ['philhealth_number', 'philHealthNumber'],
          ['pagibig_number', 'pagibigNumber'],
          ['tin_number', 'tinNumber'],
          ['passport_number', 'passportNumber'],
        ])
      : {},
    eligibility: eligibilityRow
      ? {
          ...mapCamel(eligibilityRow, [
            ['legally_eligible', 'legallyEligible'],
            ['valid_government_id', 'validGovernmentId'],
          ]),
          willingToWork: willingToWorkRows.map((row) => row.work_scope),
        }
      : { legallyEligible: '', validGovernmentId: '', willingToWork: [] },
    pwd: pwdRow
      ? mapCamel(pwdRow, [
          ['is_person_with_disability', 'isPersonWithDisability'],
          ['disability_type', 'disabilityType'],
        ])
      : {},
    specialCategories: {
      fourPsBeneficiary: specialCategoryCodesForMember.has('4ps'),
      indigenousPeople: specialCategoryCodesForMember.has('indigenous_people'),
      soloParent: specialCategoryCodesForMember.has('solo_parent'),
      seniorCitizen: specialCategoryCodesForMember.has('senior_citizen'),
      returningOfw: specialCategoryCodesForMember.has('returning_ofw'),
    },
    emergency: emergencyRow
      ? mapCamel(emergencyRow, [
          ['full_name', 'fullName'],
          ['relationship', 'relationship'],
          ['contact_number', 'contactNumber'],
          ['address', 'address'],
        ])
      : {},
    education: educationRow
      ? mapCamel(educationRow, [
          ['highest_educational_attainment', 'highestEducationalAttainment'],
          ['school_name', 'schoolName'],
          ['course_program', 'courseProgram'],
          ['year_graduated', 'yearGraduated'],
          ['honors_awards', 'honorsAwards'],
        ])
      : {},
    employment: employmentRow
      ? mapCamel(employmentRow, [
          ['employment_status', 'employmentStatus'],
          ['desired_position', 'desiredPosition'],
          ['preferred_industry', 'preferredIndustry'],
          ['expected_salary', 'expectedSalary'],
          ['years_of_experience', 'yearsOfExperience'],
        ])
      : {},
    skills: skillsRow
      ? mapCamel(skillsRow, [
          ['technical_skills', 'technicalSkills'],
          ['soft_skills', 'softSkills'],
          ['language_spoken', 'languageSpoken'],
          ['computer_skills', 'computerSkills'],
          ['certifications_license', 'certificationsLicense'],
        ])
      : {},
    documents: documentsRow
      ? mapCamel(documentsRow, [
          ['resume_attached', 'resumeAttached'],
          ['valid_id_attached', 'validIdAttached'],
          ['certificate_attached', 'certificateAttached'],
          ['other_documents_attached', 'otherDocumentsAttached'],
        ])
      : {},
  }
}

async function loadMemberRows(queryable, ids) {
  const results = await Promise.all(
    childSelects.map(({ table }) =>
      queryable.query(`SELECT * FROM ${table} WHERE member_id = ANY($1)`, [ids]),
    ),
  )

  return childSelects.reduce((acc, { table }, index) => {
    acc[table] = results[index].rows
    return acc
  }, {})
}

async function findMemberRow(queryable, id) {
  const result = await queryable.query('SELECT id, created_at, updated_at FROM members WHERE id = $1', [id])
  return result.rows[0] ?? null
}

async function hydrateMemberById(id) {
  const memberRow = await findMemberRow(pool, id)
  if (!memberRow) {
    return null
  }
  const rowsByTable = await loadMemberRows(pool, [id])
  return hydrateMember(memberRow, rowsByTable)
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

async function findMemberDuplicates({ lastName, firstName, dateOfBirth, mobileNumber, emailAddress, excludeId }) {
  const conditions = [
    '(p.last_name = $1 AND p.first_name = $2 AND p.date_of_birth = $3)',
    '(c.mobile_number IS NOT NULL AND c.mobile_number <> \'\' AND c.mobile_number = $4)',
    '(c.email_address IS NOT NULL AND c.email_address <> \'\' AND LOWER(c.email_address) = LOWER($5))',
  ]
  const params = [lastName, firstName, toDateValue(dateOfBirth), toNull(mobileNumber), toNull(emailAddress)]

  let exclusion = ''
  if (excludeId !== undefined && excludeId !== null) {
    exclusion = ' AND m.id <> $6'
    params.push(excludeId)
  }

  const sql = `SELECT DISTINCT m.id, p.last_name, p.first_name, p.date_of_birth, c.mobile_number, c.email_address
    FROM members m
    JOIN member_personal_information p ON p.member_id = m.id
    JOIN member_contact_information c ON c.member_id = m.id
    WHERE (${conditions.join(' OR ')})${exclusion}
    ORDER BY m.id
    LIMIT 20`

  const result = await pool.query(sql, params)
  return result.rows.map((row) => ({
    id: row.id,
    lastName: row.last_name,
    firstName: row.first_name,
    dateOfBirth: row.date_of_birth,
    mobileNumber: row.mobile_number,
    emailAddress: row.email_address,
  }))
}

// ---------------------------------------------------------------------------
// Write helpers (create / update)
// ---------------------------------------------------------------------------

async function insertMemberChildren(client, memberId, payload) {
  const { current, permanent } = normalizeAddresses(payload)

  for (const key of SINGLE_ROW_KEYS) {
    const { sql, params } = singleRowInsert(key, memberId, payload)
    await client.query(sql, params)
  }

  await client.query(addressInsertSql(), addressParams(memberId, 'current', current))
  await client.query(addressInsertSql(), addressParams(memberId, 'permanent', permanent))

  const willingToWork = payload.eligibility?.willingToWork ?? []
  for (const scope of willingToWork) {
    await client.query('INSERT INTO member_willing_to_work (member_id, work_scope) VALUES ($1, $2)', [memberId, scope])
  }

  const categories = Object.entries(payload.specialCategories ?? {})
    .filter(([, enabled]) => toBoolean(enabled))
    .map(([field]) => specialCategoryMap[field])
    .filter(Boolean)

  for (const code of categories) {
    await client.query('INSERT INTO member_special_categories (member_id, category_code) VALUES ($1, $2)', [
      memberId,
      code,
    ])
  }
}

async function upsertMemberChildren(client, memberId, payload) {
  const { current, permanent } = normalizeAddresses(payload)

  for (const key of SINGLE_ROW_KEYS) {
    const { sql, params } = singleRowUpsert(key, memberId, payload)
    await client.query(sql, params)
  }

  await client.query(addressUpsertSql(), addressParams(memberId, 'current', current))
  await client.query(addressUpsertSql(), addressParams(memberId, 'permanent', permanent))

  await client.query('DELETE FROM member_willing_to_work WHERE member_id = $1', [memberId])
  const willingToWork = payload.eligibility?.willingToWork ?? []
  for (const scope of willingToWork) {
    await client.query('INSERT INTO member_willing_to_work (member_id, work_scope) VALUES ($1, $2)', [memberId, scope])
  }

  await client.query('DELETE FROM member_special_categories WHERE member_id = $1', [memberId])
  const categories = Object.entries(payload.specialCategories ?? {})
    .filter(([, enabled]) => toBoolean(enabled))
    .map(([field]) => specialCategoryMap[field])
    .filter(Boolean)

  for (const code of categories) {
    await client.query('INSERT INTO member_special_categories (member_id, category_code) VALUES ($1, $2)', [
      memberId,
      code,
    ])
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body ?? {}

  if (!email || !password) {
    response.status(400).json({ message: 'Email and password are required.' })
    return
  }

  const result = await pool.query(
    'SELECT id, email, password_hash, display_name, role, account_status FROM staff_accounts WHERE email = $1 LIMIT 1',
    [email],
  )
  const staff = result.rows[0]

  if (!staff || staff.account_status !== 'Active') {
    response.status(401).json({ message: 'Invalid staff credentials.' })
    return
  }

  const passwordMatches = await verifyPassword(password, staff.password_hash)
  if (!passwordMatches) {
    response.status(401).json({ message: 'Invalid staff credentials.' })
    return
  }

  // Upgrade legacy plaintext records to a bcrypt hash on successful login.
  if (!isBcryptHash(staff.password_hash)) {
    const newHash = await hashPassword(password)
    await pool.query('UPDATE staff_accounts SET password_hash = $1 WHERE id = $2', [newHash, staff.id])
  }

  const token = createStaffToken({ email: staff.email, role: staff.role })

  response.json({
    message: 'Signed in successfully.',
    token,
    staff: { email: staff.email, displayName: staff.display_name, role: staff.role },
  })
})

app.get('/api/auth/me', requireStaffAuth, async (request, response) => {
  const result = await pool.query('SELECT email, display_name, role FROM staff_accounts WHERE email = $1 LIMIT 1', [
    request.staffSession.email,
  ])
  const staff = result.rows[0]

  if (!staff) {
    response.status(401).json({ message: 'Unauthorized' })
    return
  }

  response.json({ staff: { email: staff.email, displayName: staff.display_name, role: staff.role } })
})

app.post('/api/auth/change-password', requireStaffAuth, async (request, response) => {
  const { currentPassword, newPassword } = request.body ?? {}

  if (!currentPassword || !newPassword) {
    response.status(400).json({ message: 'Current and new passwords are required.' })
    return
  }

  const result = await pool.query(
    'SELECT id, password_hash FROM staff_accounts WHERE email = $1 LIMIT 1',
    [request.staffSession.email],
  )
  const staff = result.rows[0]

  if (!staff || !(await verifyPassword(currentPassword, staff.password_hash))) {
    response.status(401).json({ message: 'Current password is incorrect.' })
    return
  }

  const newHash = await hashPassword(newPassword)
  await pool.query('UPDATE staff_accounts SET password_hash = $1 WHERE id = $2', [newHash, staff.id])

  response.json({ message: 'Password updated successfully.' })
})

app.get('/api/members', requireStaffAuth, async (request, response) => {
  const idsResult = await pool.query('SELECT id, created_at, updated_at FROM members ORDER BY id DESC')
  const memberRows = idsResult.rows

  if (memberRows.length === 0) {
    response.json([])
    return
  }

  const ids = memberRows.map((row) => row.id)
  const rowsByTable = await loadMemberRows(pool, ids)

  response.json(memberRows.map((memberRow) => hydrateMember(memberRow, rowsByTable)))
})

app.get('/api/members/:id', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  const member = await hydrateMemberById(memberId)
  if (!member) {
    response.status(404).json({ message: 'Member not found.' })
    return
  }

  response.json(member)
})

app.post('/api/members', requireStaffAuth, async (request, response) => {
  const payload = request.body
  validateMember(payload)

  const existingMatches = await findMemberDuplicates({
    lastName: payload.personal?.lastName,
    firstName: payload.personal?.firstName,
    dateOfBirth: payload.personal?.dateOfBirth,
    mobileNumber: payload.contact?.mobileNumber,
    emailAddress: payload.contact?.emailAddress,
  })
  if (existingMatches.length > 0) {
    response.status(409).json({
      message: 'Duplicate applicant detected. A record with the same name and birth date, mobile number, or email address already exists.',
      duplicates: existingMatches,
    })
    return
  }

  const client = await pool.connect()
  let memberId = null

  try {
    await client.query('BEGIN')
    const insertResult = await client.query('INSERT INTO members DEFAULT VALUES RETURNING id')
    memberId = insertResult.rows[0].id
    await insertMemberChildren(client, memberId, payload)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  const member = await hydrateMemberById(memberId)
  response.status(201).json({ member })
})

app.put('/api/members/:id', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  const payload = request.body
  validateMember(payload)

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const existing = await client.query('SELECT id FROM members WHERE id = $1', [memberId])
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Member not found.' })
      return
    }

    await upsertMemberChildren(client, memberId, payload)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  const member = await hydrateMemberById(memberId)
  const duplicates = await findMemberDuplicates({
    lastName: payload.personal?.lastName,
    firstName: payload.personal?.firstName,
    dateOfBirth: payload.personal?.dateOfBirth,
    mobileNumber: payload.contact?.mobileNumber,
    emailAddress: payload.contact?.emailAddress,
    excludeId: memberId,
  })

  response.json({ member, duplicates })
})

app.delete('/api/members/:id', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  const client = await pool.connect()
  let attachmentPaths = []

  try {
    await client.query('BEGIN')
    const attachmentRows = await client.query('SELECT storage_path FROM document_attachments WHERE member_id = $1', [
      memberId,
    ])
    attachmentPaths = attachmentRows.rows.map((row) => row.storage_path)

    const deleteResult = await client.query('DELETE FROM members WHERE id = $1', [memberId])
    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Member not found.' })
      return
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  // Best-effort cleanup of the files in storage (DB rows already cascaded).
  await Promise.all(attachmentPaths.map((storagePath) => deleteAttachment(storagePath).catch(() => {})))

  response.json({ message: 'Member deleted.', deletedId: memberId })
})

// ---------------------------------------------------------------------------
// Digital document attachments
// ---------------------------------------------------------------------------

app.get('/api/members/:id/documents', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  const member = await findMemberRow(pool, memberId)
  if (!member) {
    response.status(404).json({ message: 'Member not found.' })
    return
  }

  const result = await pool.query(`${attachmentSelectSql()} WHERE member_id = $1 ORDER BY created_at DESC, id DESC`, [
    memberId,
  ])
  response.json(result.rows.map(serializeAttachment))
})

app.post('/api/members/:id/documents', requireStaffAuth, attachmentUpload.single('file'), async (request, response) => {
  const memberId = toMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  const documentType = request.body?.documentType
  if (!allowedDocumentTypes.has(documentType)) {
    response.status(400).json({ message: 'Invalid document type.' })
    return
  }

  if (!request.file) {
    response.status(400).json({ message: 'A file is required.' })
    return
  }

  const member = await findMemberRow(pool, memberId)
  if (!member) {
    response.status(404).json({ message: 'Member not found.' })
    return
  }

  const { buffer, size, mimetype } = request.file
  const originalName = path.basename(String(request.file.originalname ?? '')).slice(0, 255)
  const fileExtension = path.extname(originalName).toLowerCase().replace('.', '')
  const acceptedExtensions = allowedFileTypes.get(mimetype)

  if (!acceptedExtensions || !acceptedExtensions.includes(fileExtension)) {
    response.status(400).json({ message: 'File type not allowed. Upload a PDF, Word, Excel, text, or image file.' })
    return
  }

  const storagePath = `members/${memberId}/${documentType}-${crypto.randomUUID()}.${fileExtension}`

  await uploadAttachment({ storagePath, buffer, contentType: mimetype })

  let inserted
  try {
    const insertResult = await pool.query(
      `INSERT INTO document_attachments (member_id, document_type, file_name, storage_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, document_type, file_name, mime_type, file_size, uploaded_by, created_at`,
      [memberId, documentType, originalName, storagePath, mimetype, size, request.staffSession.email],
    )
    inserted = insertResult.rows[0]
  } catch (error) {
    // Keep DB and storage consistent: drop the file if the row cannot be saved.
    await deleteAttachment(storagePath).catch(() => {})
    throw error
  }

  response.status(201).json({ attachment: serializeAttachment(inserted) })
})

app.get('/api/members/:id/documents/:attachmentId/download', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  const attachmentId = toMemberId(request.params.attachmentId)
  if (memberId === null || attachmentId === null) {
    response.status(400).json({ message: 'Invalid member or attachment id.' })
    return
  }

  const result = await pool.query(`${attachmentSelectSql()} WHERE id = $1 AND member_id = $2`, [attachmentId, memberId])
  const attachment = result.rows[0]

  if (!attachment) {
    response.status(404).json({ message: 'Attachment not found.' })
    return
  }

  const fileBuffer = await downloadAttachment(attachment.storage_path)

  response.setHeader('Content-Type', attachment.mime_type)
  response.setHeader('Content-Length', String(attachment.file_size))
  response.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
  )
  response.send(fileBuffer)
})

app.delete('/api/members/:id/documents/:attachmentId', requireStaffAuth, async (request, response) => {
  const memberId = toMemberId(request.params.id)
  const attachmentId = toMemberId(request.params.attachmentId)
  if (memberId === null || attachmentId === null) {
    response.status(400).json({ message: 'Invalid member or attachment id.' })
    return
  }

  const result = await pool.query('SELECT storage_path FROM document_attachments WHERE id = $1 AND member_id = $2', [
    attachmentId,
    memberId,
  ])
  const attachment = result.rows[0]

  if (!attachment) {
    response.status(404).json({ message: 'Attachment not found.' })
    return
  }

  await pool.query('DELETE FROM document_attachments WHERE id = $1', [attachmentId])
  await deleteAttachment(attachment.storage_path).catch(() => {})

  response.json({ message: 'Attachment deleted.', deletedId: attachmentId })
})

// Error handling
app.use((error, request, response, _next) => {
  let status = error.status ?? 500

  if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  }

  if (status >= 500) {
    console.error(error)
  }
  response.status(status).json({ message: error.message || 'Internal server error.' })
})

export default app
