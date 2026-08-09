// PostgreSQL data-access definitions for member child tables.
// One source of truth shared by server/app.js and the test suite.

// Every query is schema-qualified at build time so a leaked search_path on a
// pooled connection (e.g. a CI job that ran in a test schema) can never
// redirect reads/writes to the wrong schema. Production stays on `public`.
export const SCHEMA = process.env.DB_SCHEMA ?? 'public'
const t = (table) => `${SCHEMA}.${table}`

export const MEMBER_CHILD_TABLES = [
  'member_personal_information',
  'member_contact_information',
  'member_addresses',
  'member_government_information',
  'member_employment_eligibility',
  'member_willing_to_work',
  'member_pwd_information',
  'member_special_categories',
  'member_emergency_contacts',
  'member_educational_background',
  'member_employment_information',
  'member_skills',
  'member_documents',
]

// [databaseColumn, apiField]
const COLUMNS = {
  personal: [
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
  ],
  contact: [
    ['mobile_number', 'mobileNumber'],
    ['email_address', 'emailAddress'],
    ['facebook_profile', 'facebookProfile'],
  ],
  government: [
    ['philsys_national_id_number', 'philSysNationalIdNumber'],
    ['sss_number', 'sssNumber'],
    ['philhealth_number', 'philHealthNumber'],
    ['pagibig_number', 'pagibigNumber'],
    ['tin_number', 'tinNumber'],
    ['passport_number', 'passportNumber'],
  ],
  eligibility: [
    ['legally_eligible', 'legallyEligible'],
    ['valid_government_id', 'validGovernmentId'],
  ],
  pwd: [
    ['is_person_with_disability', 'isPersonWithDisability'],
    ['disability_type', 'disabilityType'],
  ],
  emergency: [
    ['full_name', 'fullName'],
    ['relationship', 'relationship'],
    ['contact_number', 'contactNumber'],
    ['address', 'address'],
  ],
  education: [
    ['highest_educational_attainment', 'highestEducationalAttainment'],
    ['school_name', 'schoolName'],
    ['course_program', 'courseProgram'],
    ['year_graduated', 'yearGraduated'],
    ['honors_awards', 'honorsAwards'],
  ],
  employment: [
    ['employment_status', 'employmentStatus'],
    ['desired_position', 'desiredPosition'],
    ['preferred_industry', 'preferredIndustry'],
    ['expected_salary', 'expectedSalary'],
    ['years_of_experience', 'yearsOfExperience'],
  ],
  skills: [
    ['technical_skills', 'technicalSkills'],
    ['soft_skills', 'softSkills'],
    ['language_spoken', 'languageSpoken'],
    ['computer_skills', 'computerSkills'],
    ['certifications_license', 'certificationsLicense'],
  ],
  documents: [
    ['resume_attached', 'resumeAttached'],
    ['valid_id_attached', 'validIdAttached'],
    ['certificate_attached', 'certificateAttached'],
    ['other_documents_attached', 'otherDocumentsAttached'],
  ],
}

// Every one-to-one child table keyed by member_id.
export const SINGLE_ROW_KEYS = [
  'personal',
  'contact',
  'government',
  'eligibility',
  'pwd',
  'emergency',
  'education',
  'employment',
  'skills',
  'documents',
]

export const SINGLE_ROW_TABLES = Object.freeze({
  personal: 'member_personal_information',
  contact: 'member_contact_information',
  government: 'member_government_information',
  eligibility: 'member_employment_eligibility',
  pwd: 'member_pwd_information',
  emergency: 'member_emergency_contacts',
  education: 'member_educational_background',
  employment: 'member_employment_information',
  skills: 'member_skills',
  documents: 'member_documents',
})

function buildSingleRowSql(table, columns, startingIndex) {
  const columnNames = columns.map(([column]) => column)
  const placeholders = columns.map((_, index) => `$${startingIndex + index}`)

  return {
    selectSql: `SELECT * FROM ${t(table)} WHERE member_id = $1`,
    insertSql: `INSERT INTO ${t(table)} (member_id, ${columnNames.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`,
    upsertSql: `INSERT INTO ${t(table)} (member_id, ${columnNames.join(', ')})
      VALUES ($1, ${placeholders.join(', ')})
      ON CONFLICT (member_id) DO UPDATE SET
        ${columns.map(([column]) => `${column} = EXCLUDED.${column}`).join(',\n        ')}`,
  }
}

export const MEMBER_CHILD_QUERIES = SINGLE_ROW_KEYS
  .map((key) => buildSingleRowSql(SINGLE_ROW_TABLES[key], COLUMNS[key], 2))
  .map(({ selectSql }) => selectSql)
  .concat([
    `SELECT * FROM ${t('member_addresses')} WHERE member_id = ANY($1) ORDER BY address_type`,
    `SELECT * FROM ${t('member_willing_to_work')} WHERE member_id = ANY($1) ORDER BY work_scope`,
    `SELECT * FROM ${t('member_special_categories')} WHERE member_id = ANY($1) ORDER BY category_code`,
  ])

export function getChildTableInfo(key) {
  return {
    table: SINGLE_ROW_TABLES[key],
    columns: COLUMNS[key],
  }
}
