import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './db.js'
import {
  createStaffToken,
  hashPassword,
  isBcryptHash,
  requireStaffAuth,
  verifyPassword,
} from './auth.js'

const app = express()

const specialCategoryMap = {
  fourPsBeneficiary: '4ps',
  indigenousPeople: 'indigenous_people',
  soloParent: 'solo_parent',
  seniorCitizen: 'senior_citizen',
  returningOfw: 'returning_ofw',
}

const reverseSpecialCategoryMap = Object.fromEntries(
  Object.entries(specialCategoryMap).map(([field, code]) => [code, field]),
)

const documentFields = ['resumeAttached', 'validIdAttached', 'certificateAttached', 'otherDocumentsAttached']

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
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

function toNull(value) {
  if (value === '' || value === undefined || value === null) {
    return null
  }

  return value
}

function toTrimmedString(value) {
  const nextValue = toNull(value)
  return nextValue === null ? null : String(nextValue).trim() || null
}

function toIntegerOrNull(value) {
  const nextValue = toNull(value)
  if (nextValue === null) {
    return null
  }

  const nextNumber = Number(nextValue)
  return Number.isFinite(nextNumber) ? nextNumber : null
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function toDateValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const nextValue = toTrimmedString(value)
  return nextValue === null ? null : nextValue.slice(0, 10)
}

function toInputString(value) {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value)
}

function emptySpecialCategories() {
  return Object.keys(specialCategoryMap).reduce((categories, field) => {
    categories[field] = false
    return categories
  }, {})
}

function emptyDocuments() {
  return documentFields.reduce((documents, field) => {
    documents[field] = false
    return documents
  }, {})
}

function parseMemberId(rawValue) {
  const id = Number(rawValue)
  return Number.isInteger(id) && id > 0 ? id : null
}

const civilStatusValues = new Set(['Single', 'Married', 'Widowed', 'Separated'])
const sexValues = new Set(['M', 'F'])
const willingToWorkValues = new Set(['Within Municipality', 'Within Province', 'Anywhere in the Philippines', 'Overseas'])

// Required personal fields keep the registry usable: a record without a name
// cannot be searched or exported.
function validateMemberPayload(payload) {
  const personal = payload?.personal ?? {}

  const lastName = toTrimmedString(personal.lastName)
  const firstName = toTrimmedString(personal.firstName)

  if (!lastName) {
    throw new InputError('Last name is required.')
  }
  if (!firstName) {
    throw new InputError('First name is required.')
  }

  if (personal.sex !== undefined && !sexValues.has(personal.sex)) {
    throw new InputError('Sex must be either M or F.')
  }

  if (personal.civilStatus !== undefined && !civilStatusValues.has(personal.civilStatus)) {
    throw new InputError('Invalid civil status.')
  }

  const willingToWork = Array.isArray(payload?.eligibility?.willingToWork)
    ? payload.eligibility.willingToWork
    : []
  for (const workScope of willingToWork) {
    if (!willingToWorkValues.has(workScope)) {
      throw new InputError('Invalid willing-to-work scope.')
    }
  }

  for (const [field] of Object.entries(specialCategoryMap)) {
    const selected = payload?.specialCategories?.[field]
    if (selected !== undefined && typeof selected !== 'boolean') {
      throw new InputError('Invalid special category value.')
    }
  }
}

// Finds records that may be the same person, so staff can confirm before
// creating a duplicate registry entry. Matches on full name + birth date,
// mobile number, or email address.
async function findMemberDuplicates(candidate, excludeId = null) {
  const personal = candidate?.personal ?? {}
  const contact = candidate?.contact ?? {}

  const lastName = toTrimmedString(personal.lastName)
  const firstName = toTrimmedString(personal.firstName)
  const dateOfBirth = toDateValue(personal.dateOfBirth)
  const mobileNumber = toTrimmedString(contact.mobileNumber)
  const emailAddress = toTrimmedString(contact.emailAddress)?.toLowerCase()

  const conditions = []
  const values = []

  if (lastName && firstName) {
    conditions.push(
      '(last_name = ? AND first_name = ? AND date_of_birth IS NOT NULL AND date_of_birth = ?)',
    )
    values.push(lastName, firstName, dateOfBirth)
  }

  if (mobileNumber) {
    conditions.push('mobile_number = ?')
    values.push(mobileNumber)
  }

  if (emailAddress) {
    conditions.push('LOWER(email_address) = ?')
    values.push(emailAddress)
  }

  if (conditions.length === 0) {
    return []
  }

  const query = `
    SELECT m.id, m.created_at, mp.last_name, mp.first_name, mp.middle_name,
           mp.date_of_birth, mc.mobile_number, mc.email_address
    FROM members m
    JOIN member_personal_information mp ON mp.member_id = m.id
    LEFT JOIN member_contact_information mc ON mc.member_id = m.id
    WHERE (${conditions.join(' OR ')})
    ORDER BY m.id DESC
  `

  const [rows] = await pool.query(query, values)

  return rows
    .filter((row) => row.id !== excludeId)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      lastName: toInputString(row.last_name),
      firstName: toInputString(row.first_name),
      middleName: toInputString(row.middle_name),
      dateOfBirth: toDateValue(row.date_of_birth),
      mobileNumber: toInputString(row.mobile_number),
      emailAddress: toInputString(row.email_address),
    }))
}

app.post('/api/auth/login', async (request, response) => {
  const email = toTrimmedString(request.body?.email)?.toLowerCase()
  const password = toTrimmedString(request.body?.password)

  if (!email || !password) {
    response.status(400).json({ message: 'Email and password are required.' })
    return
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, display_name, role, account_status FROM staff_accounts WHERE email = ? LIMIT 1',
      [email],
    )

    const staff = rows[0]

    if (!staff || staff.account_status !== 'Active') {
      response.status(401).json({ message: 'Invalid staff credentials.' })
      return
    }

    const isValid = await verifyPassword(password, staff.password_hash)
    if (!isValid) {
      response.status(401).json({ message: 'Invalid staff credentials.' })
      return
    }

    // Upgrade legacy plaintext passwords to bcrypt on first successful login.
    if (!isBcryptHash(staff.password_hash)) {
      const newHash = await hashPassword(password)
      await pool.query('UPDATE staff_accounts SET password_hash = ? WHERE id = ?', [newHash, staff.id]).catch((error) => {
        console.warn('[auth] Failed to rehash legacy password for', staff.email, error)
      })
    }

    response.json({
      message: 'Signed in successfully.',
      token: createStaffToken({ email: staff.email, role: staff.role }),
      staff: {
        email: staff.email,
        displayName: staff.display_name,
        role: staff.role,
      },
    })
  } catch (error) {
    console.error('[auth] Login failed.', error)
    response.status(500).json({ message: 'Failed to sign in.' })
  }
})

app.get('/api/auth/me', requireStaffAuth, async (request, response) => {
  try {
    const [rows] = await pool.query(
      'SELECT email, display_name, role FROM staff_accounts WHERE email = ? LIMIT 1',
      [request.staffSession.email],
    )

    const staff = rows[0]
    if (!staff) {
      response.status(401).json({ message: 'Unauthorized' })
      return
    }

    response.json({
      staff: {
        email: staff.email,
        displayName: staff.display_name,
        role: staff.role,
      },
    })
  } catch (error) {
    console.error('[auth] Failed to load staff session.', error)
    response.status(500).json({ message: 'Failed to load staff session.' })
  }
})

app.post('/api/auth/logout', (_request, response) => {
  response.json({ message: 'Signed out successfully.' })
})

app.use('/api/members', requireStaffAuth)

function mapAddressRow(row) {
  return {
    sameAsCurrent: Boolean(row.same_as_current),
    houseNoStreet: toInputString(row.house_no_street),
    barangay: toInputString(row.barangay),
    municipalityCity: toInputString(row.municipality_city),
    province: toInputString(row.province),
    zipCode: toInputString(row.zip_code),
  }
}

function mapMemberRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    personal: {
      lastName: toInputString(row.last_name),
      firstName: toInputString(row.first_name),
      middleName: toInputString(row.middle_name),
      suffix: toInputString(row.suffix),
      sex: row.sex ?? 'M',
      dateOfBirth: toDateValue(row.date_of_birth),
      placeOfBirth: toInputString(row.place_of_birth),
      age: row.age === null || row.age === undefined ? '' : String(row.age),
      civilStatus: row.civil_status ?? 'Single',
      nationality: toInputString(row.nationality),
      religion: toInputString(row.religion),
    },
    contact: {
      mobileNumber: toInputString(row.mobile_number),
      emailAddress: toInputString(row.email_address),
      facebookProfile: toInputString(row.facebook_profile),
    },
    currentAddress: {
      houseNoStreet: toInputString(row.current_house_no_street),
      barangay: toInputString(row.current_barangay),
      municipalityCity: toInputString(row.current_municipality_city),
      province: toInputString(row.current_province),
      zipCode: toInputString(row.current_zip_code),
    },
    permanentAddress: {
      sameAsCurrent: Boolean(row.permanent_same_as_current),
      houseNoStreet: toInputString(row.permanent_house_no_street),
      barangay: toInputString(row.permanent_barangay),
      municipalityCity: toInputString(row.permanent_municipality_city),
      province: toInputString(row.permanent_province),
      zipCode: toInputString(row.permanent_zip_code),
    },
    government: {
      philSysNationalIdNumber: toInputString(row.philsys_national_id_number),
      sssNumber: toInputString(row.sss_number),
      philHealthNumber: toInputString(row.philhealth_number),
      pagibigNumber: toInputString(row.pagibig_number),
      tinNumber: toInputString(row.tin_number),
      passportNumber: toInputString(row.passport_number),
    },
    eligibility: {
      legallyEligible: row.legally_eligible ?? 'Yes',
      validGovernmentId: row.valid_government_id ?? 'Yes',
      willingToWork: [],
    },
    pwd: {
      isPersonWithDisability: row.is_person_with_disability ?? 'No',
      disabilityType: toInputString(row.disability_type),
    },
    specialCategories: emptySpecialCategories(),
    emergency: {
      fullName: toInputString(row.emergency_full_name),
      relationship: toInputString(row.emergency_relationship),
      contactNumber: toInputString(row.emergency_contact_number),
      address: toInputString(row.emergency_address),
    },
    education: {
      highestEducationalAttainment: toInputString(row.highest_educational_attainment),
      schoolName: toInputString(row.school_name),
      courseProgram: toInputString(row.course_program),
      yearGraduated: toInputString(row.year_graduated),
      honorsAwards: toInputString(row.honors_awards),
    },
    employment: {
      employmentStatus: row.employment_status ?? 'Employment',
      desiredPosition: toInputString(row.desired_position),
      preferredIndustry: toInputString(row.preferred_industry),
      expectedSalary: toInputString(row.expected_salary),
      yearsOfExperience: toInputString(row.years_of_experience),
    },
    skills: {
      technicalSkills: toInputString(row.technical_skills),
      softSkills: toInputString(row.soft_skills),
      languageSpoken: toInputString(row.language_spoken),
      computerSkills: toInputString(row.computer_skills),
      certificationsLicense: toInputString(row.certifications_license),
    },
    documents: emptyDocuments(),
  }
}

const MEMBER_CHILD_QUERIES = [
  'SELECT * FROM member_personal_information WHERE member_id IN (?)',
  'SELECT * FROM member_contact_information WHERE member_id IN (?)',
  'SELECT * FROM member_addresses WHERE member_id IN (?)',
  'SELECT * FROM member_government_information WHERE member_id IN (?)',
  'SELECT * FROM member_employment_eligibility WHERE member_id IN (?)',
  'SELECT * FROM member_willing_to_work WHERE member_id IN (?)',
  'SELECT * FROM member_pwd_information WHERE member_id IN (?)',
  'SELECT * FROM member_special_categories WHERE member_id IN (?)',
  'SELECT * FROM member_emergency_contacts WHERE member_id IN (?)',
  'SELECT * FROM member_educational_background WHERE member_id IN (?)',
  'SELECT * FROM member_employment_information WHERE member_id IN (?)',
  'SELECT * FROM member_skills WHERE member_id IN (?)',
  'SELECT * FROM member_documents WHERE member_id IN (?)',
]

const MEMBER_CHILD_ROW_NAMES = [
  'personal',
  'contact',
  'addresses',
  'government',
  'eligibility',
  'willing',
  'pwd',
  'special',
  'emergency',
  'education',
  'employment',
  'skills',
  'documents',
]

function groupRowsByMemberId(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const list = grouped.get(row.member_id) ?? []
    list.push(row)
    grouped.set(row.member_id, list)
  }

  return grouped
}

function assembleMember(memberRow, rowsByTable) {
  const member = mapMemberRow(memberRow)
  const personalRow = rowsByTable.personal.get(memberRow.id)?.[0] ?? {}
  const contactRow = rowsByTable.contact.get(memberRow.id)?.[0] ?? {}
  const addressRows = rowsByTable.addresses.get(memberRow.id) ?? []
  const currentAddressRow = addressRows.find((row) => row.address_type === 'current') ?? {}
  const permanentAddressRow = addressRows.find((row) => row.address_type === 'permanent') ?? {}
  const governmentRow = rowsByTable.government.get(memberRow.id)?.[0] ?? {}
  const eligibilityRow = rowsByTable.eligibility.get(memberRow.id)?.[0] ?? {}
  const willingRows = rowsByTable.willing.get(memberRow.id) ?? []
  const pwdRow = rowsByTable.pwd.get(memberRow.id)?.[0] ?? {}
  const specialRows = rowsByTable.special.get(memberRow.id) ?? []
  const emergencyRow = rowsByTable.emergency.get(memberRow.id)?.[0] ?? {}
  const educationRow = rowsByTable.education.get(memberRow.id)?.[0] ?? {}
  const employmentRow = rowsByTable.employment.get(memberRow.id)?.[0] ?? {}
  const skillsRow = rowsByTable.skills.get(memberRow.id)?.[0] ?? {}
  const documentRow = rowsByTable.documents.get(memberRow.id)?.[0] ?? {}

  member.personal = {
    ...member.personal,
    lastName: toInputString(personalRow.last_name),
    firstName: toInputString(personalRow.first_name),
    middleName: toInputString(personalRow.middle_name),
    suffix: toInputString(personalRow.suffix),
    sex: personalRow.sex ?? 'M',
    dateOfBirth: toDateValue(personalRow.date_of_birth),
    placeOfBirth: toInputString(personalRow.place_of_birth),
    age: personalRow.age === null || personalRow.age === undefined ? '' : String(personalRow.age),
    civilStatus: personalRow.civil_status ?? 'Single',
    nationality: toInputString(personalRow.nationality),
    religion: toInputString(personalRow.religion),
  }
  member.contact = {
    mobileNumber: toInputString(contactRow.mobile_number),
    emailAddress: toInputString(contactRow.email_address),
    facebookProfile: toInputString(contactRow.facebook_profile),
  }
  member.currentAddress = mapAddressRow(currentAddressRow)
  member.permanentAddress = mapAddressRow(permanentAddressRow)
  member.government = {
    philSysNationalIdNumber: toInputString(governmentRow.philsys_national_id_number),
    sssNumber: toInputString(governmentRow.sss_number),
    philHealthNumber: toInputString(governmentRow.philhealth_number),
    pagibigNumber: toInputString(governmentRow.pagibig_number),
    tinNumber: toInputString(governmentRow.tin_number),
    passportNumber: toInputString(governmentRow.passport_number),
  }
  member.eligibility = {
    legallyEligible: eligibilityRow.legally_eligible ?? 'Yes',
    validGovernmentId: eligibilityRow.valid_government_id ?? 'Yes',
    willingToWork: willingRows.map((row) => row.work_scope),
  }
  member.pwd = {
    isPersonWithDisability: pwdRow.is_person_with_disability ?? 'No',
    disabilityType: toInputString(pwdRow.disability_type),
  }
  member.specialCategories = emptySpecialCategories()
  specialRows.forEach((row) => {
    const field = reverseSpecialCategoryMap[row.category_code]
    if (field) {
      member.specialCategories[field] = true
    }
  })
  member.emergency = {
    fullName: toInputString(emergencyRow.full_name),
    relationship: toInputString(emergencyRow.relationship),
    contactNumber: toInputString(emergencyRow.contact_number),
    address: toInputString(emergencyRow.address),
  }
  member.education = {
    highestEducationalAttainment: toInputString(educationRow.highest_educational_attainment),
    schoolName: toInputString(educationRow.school_name),
    courseProgram: toInputString(educationRow.course_program),
    yearGraduated: toInputString(educationRow.year_graduated),
    honorsAwards: toInputString(educationRow.honors_awards),
  }
  member.employment = {
    employmentStatus: employmentRow.employment_status ?? 'Employment',
    desiredPosition: toInputString(employmentRow.desired_position),
    preferredIndustry: toInputString(employmentRow.preferred_industry),
    expectedSalary: toInputString(employmentRow.expected_salary),
    yearsOfExperience: toInputString(employmentRow.years_of_experience),
  }
  member.skills = {
    technicalSkills: toInputString(skillsRow.technical_skills),
    softSkills: toInputString(skillsRow.soft_skills),
    languageSpoken: toInputString(skillsRow.language_spoken),
    computerSkills: toInputString(skillsRow.computer_skills),
    certificationsLicense: toInputString(skillsRow.certifications_license),
  }
  member.documents = {
    resumeAttached: Boolean(documentRow.resume_attached),
    validIdAttached: Boolean(documentRow.valid_id_attached),
    certificateAttached: Boolean(documentRow.certificate_attached),
    otherDocumentsAttached: Boolean(documentRow.other_documents_attached),
  }

  return member
}

async function fetchMembers(memberIds) {
  const ids = [...new Set(memberIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) {
    return []
  }

  const [memberRows] = await pool.query(
    'SELECT id, created_at, updated_at FROM members WHERE id IN (?) ORDER BY id DESC',
    [ids],
  )
  if (memberRows.length === 0) {
    return []
  }

  const childRows = await Promise.all(MEMBER_CHILD_QUERIES.map((query) => pool.query(query, [ids])))

  const rowsByTable = Object.fromEntries(
    MEMBER_CHILD_ROW_NAMES.map((name, index) => [name, groupRowsByMemberId(childRows[index][0])]),
  )

  return memberRows.map((memberRow) => assembleMember(memberRow, rowsByTable))
}

async function fetchMember(memberId) {
  const members = await fetchMembers([memberId])
  return members[0] ?? null
}

const MAX_SAVE_ATTEMPTS = 3

// Deadlock-safe retry around the multi-table member save. Two staff members
// saving at the same moment can trip InnoDB lock ordering across the child
// tables; retrying a fresh transaction resolves it without user action.
async function saveMember(memberId, payload, mode) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new InputError('Request body must be a member object.')
  }

  validateMemberPayload(payload)

  for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt += 1) {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

    let resolvedMemberId = memberId
    if (mode === 'create') {
      const [result] = await connection.query('INSERT INTO members () VALUES ()')
      resolvedMemberId = result.insertId
    } else {
      const [existingRows] = await connection.query('SELECT id FROM members WHERE id = ?', [memberId])
      if (existingRows.length === 0) {
        throw new Error('Member not found')
      }
    }

    const permanentAddress = payload.permanentAddress?.sameAsCurrent
      ? { ...payload.currentAddress, sameAsCurrent: true }
      : payload.permanentAddress ?? {}

    const currentAddressValues = [
      resolvedMemberId,
      'current',
      0,
      toTrimmedString(payload.currentAddress?.houseNoStreet),
      toTrimmedString(payload.currentAddress?.barangay),
      toTrimmedString(payload.currentAddress?.municipalityCity),
      toTrimmedString(payload.currentAddress?.province),
      toTrimmedString(payload.currentAddress?.zipCode),
    ]

    const permanentAddressValues = [
      resolvedMemberId,
      'permanent',
      toBoolean(payload.permanentAddress?.sameAsCurrent) ? 1 : 0,
      toTrimmedString(permanentAddress.houseNoStreet),
      toTrimmedString(permanentAddress.barangay),
      toTrimmedString(permanentAddress.municipalityCity),
      toTrimmedString(permanentAddress.province),
      toTrimmedString(permanentAddress.zipCode),
    ]

    const personal = payload.personal ?? {}
    const contact = payload.contact ?? {}
    const government = payload.government ?? {}
    const eligibility = payload.eligibility ?? {}
    const pwd = payload.pwd ?? {}
    const emergency = payload.emergency ?? {}
    const education = payload.education ?? {}
    const employment = payload.employment ?? {}
    const skills = payload.skills ?? {}
    const documents = payload.documents ?? {}

    await Promise.all([
      connection.query('DELETE FROM member_personal_information WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_contact_information WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_addresses WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_government_information WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_employment_eligibility WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_willing_to_work WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_pwd_information WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_special_categories WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_emergency_contacts WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_educational_background WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_employment_information WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_skills WHERE member_id = ?', [resolvedMemberId]),
      connection.query('DELETE FROM member_documents WHERE member_id = ?', [resolvedMemberId]),
    ])

    await connection.query(
      `INSERT INTO member_personal_information (
        member_id,
        last_name,
        first_name,
        middle_name,
        suffix,
        sex,
        date_of_birth,
        place_of_birth,
        age,
        civil_status,
        nationality,
        religion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(personal.lastName),
        toTrimmedString(personal.firstName),
        toTrimmedString(personal.middleName),
        toTrimmedString(personal.suffix),
        personal.sex ?? 'M',
        toDateValue(personal.dateOfBirth),
        toTrimmedString(personal.placeOfBirth),
        toIntegerOrNull(personal.age),
        personal.civilStatus ?? 'Single',
        toTrimmedString(personal.nationality),
        toTrimmedString(personal.religion),
      ],
    )

    await connection.query(
      `INSERT INTO member_contact_information (
        member_id,
        mobile_number,
        email_address,
        facebook_profile
      ) VALUES (?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(contact.mobileNumber),
        toTrimmedString(contact.emailAddress),
        toTrimmedString(contact.facebookProfile),
      ],
    )

    await connection.query(
      `INSERT INTO member_addresses (
        member_id,
        address_type,
        same_as_current,
        house_no_street,
        barangay,
        municipality_city,
        province,
        zip_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      currentAddressValues,
    )

    await connection.query(
      `INSERT INTO member_addresses (
        member_id,
        address_type,
        same_as_current,
        house_no_street,
        barangay,
        municipality_city,
        province,
        zip_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      permanentAddressValues,
    )

    await connection.query(
      `INSERT INTO member_government_information (
        member_id,
        philsys_national_id_number,
        sss_number,
        philhealth_number,
        pagibig_number,
        tin_number,
        passport_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(government.philSysNationalIdNumber),
        toTrimmedString(government.sssNumber),
        toTrimmedString(government.philHealthNumber),
        toTrimmedString(government.pagibigNumber),
        toTrimmedString(government.tinNumber),
        toTrimmedString(government.passportNumber),
      ],
    )

    await connection.query(
      `INSERT INTO member_employment_eligibility (
        member_id,
        legally_eligible,
        valid_government_id
      ) VALUES (?, ?, ?)`,
      [resolvedMemberId, eligibility.legallyEligible ?? 'Yes', eligibility.validGovernmentId ?? 'Yes'],
    )

    const workScopes = Array.isArray(eligibility.willingToWork) ? eligibility.willingToWork : []
    await Promise.all(
      workScopes.map((workScope) =>
        connection.query(
          'INSERT INTO member_willing_to_work (member_id, work_scope) VALUES (?, ?)',
          [resolvedMemberId, workScope],
        ),
      ),
    )

    await connection.query(
      `INSERT INTO member_pwd_information (
        member_id,
        is_person_with_disability,
        disability_type
      ) VALUES (?, ?, ?)`,
      [resolvedMemberId, pwd.isPersonWithDisability ?? 'No', toTrimmedString(pwd.disabilityType)],
    )

    const selectedCategories = Object.entries(payload.specialCategories ?? {})
      .filter(([, selected]) => Boolean(selected))
      .map(([field]) => specialCategoryMap[field])
      .filter(Boolean)

    await Promise.all(
      selectedCategories.map((categoryCode) =>
        connection.query(
          'INSERT INTO member_special_categories (member_id, category_code) VALUES (?, ?)',
          [resolvedMemberId, categoryCode],
        ),
      ),
    )

    await connection.query(
      `INSERT INTO member_emergency_contacts (
        member_id,
        full_name,
        relationship,
        contact_number,
        address
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(emergency.fullName),
        toTrimmedString(emergency.relationship),
        toTrimmedString(emergency.contactNumber),
        toTrimmedString(emergency.address),
      ],
    )

    await connection.query(
      `INSERT INTO member_educational_background (
        member_id,
        highest_educational_attainment,
        school_name,
        course_program,
        year_graduated,
        honors_awards
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(education.highestEducationalAttainment),
        toTrimmedString(education.schoolName),
        toTrimmedString(education.courseProgram),
        toTrimmedString(education.yearGraduated),
        toTrimmedString(education.honorsAwards),
      ],
    )

    await connection.query(
      `INSERT INTO member_employment_information (
        member_id,
        employment_status,
        desired_position,
        preferred_industry,
        expected_salary,
        years_of_experience
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        employment.employmentStatus ?? 'Employment',
        toTrimmedString(employment.desiredPosition),
        toTrimmedString(employment.preferredIndustry),
        toTrimmedString(employment.expectedSalary),
        toTrimmedString(employment.yearsOfExperience),
      ],
    )

    await connection.query(
      `INSERT INTO member_skills (
        member_id,
        technical_skills,
        soft_skills,
        language_spoken,
        computer_skills,
        certifications_license
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toTrimmedString(skills.technicalSkills),
        toTrimmedString(skills.softSkills),
        toTrimmedString(skills.languageSpoken),
        toTrimmedString(skills.computerSkills),
        toTrimmedString(skills.certificationsLicense),
      ],
    )

    await connection.query(
      `INSERT INTO member_documents (
        member_id,
        resume_attached,
        valid_id_attached,
        certificate_attached,
        other_documents_attached
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        resolvedMemberId,
        toBoolean(documents.resumeAttached) ? 1 : 0,
        toBoolean(documents.validIdAttached) ? 1 : 0,
        toBoolean(documents.certificateAttached) ? 1 : 0,
        toBoolean(documents.otherDocumentsAttached) ? 1 : 0,
      ],
    )

    await connection.commit()

    const savedMember = await fetchMember(resolvedMemberId)
    return savedMember
  } catch (error) {
    await connection.rollback().catch(() => {})

    const isRetryable = error?.code === 'ER_LOCK_DEADLOCK' || error?.code === 'ER_LOCK_WAIT_TIMEOUT'
    if (isRetryable && attempt < MAX_SAVE_ATTEMPTS) {
      console.warn(`[members] Save transaction contended, retrying (${attempt}/${MAX_SAVE_ATTEMPTS}).`)
      continue
    }

    throw error
  } finally {
    connection.release()
  }
  }
}

async function deleteMember(memberId) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const [result] = await connection.query('DELETE FROM members WHERE id = ?', [memberId])
    await connection.commit()

    return result.affectedRows > 0
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

app.get('/api/health', (request, response) => {
  response.json({ ok: true })
})

app.get('/api/members', async (request, response) => {
  try {
    const [rows] = await pool.query('SELECT id FROM members ORDER BY id DESC')
    const members = await fetchMembers(rows.map((row) => row.id))
    response.json(members)
  } catch (error) {
    console.error('[members] Failed to load members.', error)
    response.status(500).json({ message: 'Failed to load members.' })
  }
})

app.get('/api/members/:id', async (request, response) => {
  const memberId = parseMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  try {
    const member = await fetchMember(memberId)
    if (!member) {
      response.status(404).json({ message: 'Member not found.' })
      return
    }

    response.json(member)
  } catch (error) {
    console.error('[members] Failed to load member.', error)
    response.status(500).json({ message: 'Failed to load member.' })
  }
})

app.post('/api/members', async (request, response) => {
  try {
    const savedMember = await saveMember(null, request.body, 'create')
    const duplicates = await findMemberDuplicates(request.body, savedMember.id)
    response.status(201).json({
      message: 'Member record inserted successfully.',
      member: savedMember,
      duplicates,
    })
  } catch (error) {
    if (error instanceof InputError) {
      response.status(400).json({ message: error.message })
      return
    }

    console.error('[members] Failed to create member.', error)
    response.status(500).json({ message: 'Failed to create member.' })
  }
})

app.put('/api/members/:id', async (request, response) => {
  const memberId = parseMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  try {
    const savedMember = await saveMember(memberId, request.body, 'update')
    const duplicates = await findMemberDuplicates(request.body, memberId)
    response.json({
      message: 'Member record updated successfully.',
      member: savedMember,
      duplicates,
    })
  } catch (error) {
    if (error.message === 'Member not found') {
      response.status(404).json({ message: error.message })
      return
    }

    if (error instanceof InputError) {
      response.status(400).json({ message: error.message })
      return
    }

    console.error('[members] Failed to update member.', error)
    response.status(500).json({ message: 'Failed to update member.' })
  }
})

app.delete('/api/members/:id', async (request, response) => {
  const memberId = parseMemberId(request.params.id)
  if (memberId === null) {
    response.status(400).json({ message: 'Invalid member id.' })
    return
  }

  try {
    const deleted = await deleteMember(memberId)
    if (!deleted) {
      response.status(404).json({ message: 'Member not found.' })
      return
    }

    response.json({ message: 'Member record deleted successfully.' })
  } catch (error) {
    console.error('[members] Failed to delete member.', error)
    response.status(500).json({ message: 'Failed to delete member.' })
  }
})

// API 404 fallback (must be registered after all /api routes).
app.use('/api', (request, response) => {
  response.status(404).json({ message: 'Not found.' })
})// Centralized error handler.
app.use((error, request, response, _next) => {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500

  if (status >= 500) {
    console.error(`[error] ${request.method} ${request.originalUrl}`, error)
  }

  response.status(status).json({ message: status >= 500 ? 'Internal server error.' : error.message })
})

export default app
