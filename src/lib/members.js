import {
  documentOptions,
  uppercaseTextFieldSet,
} from './constants.js'
import {
  calculateAge,
  formatSalaryInput,
  formatSex,
  formatYesNo,
  normalizeSearchValue,
} from './format.js'

export function createEmptyForm() {
  return {
    personal: {
      lastName: '',
      firstName: '',
      middleName: '',
      suffix: '',
      sex: 'M',
      dateOfBirth: '',
      placeOfBirth: '',
      age: '',
      civilStatus: 'Single',
      nationality: '',
      religion: '',
    },
    contact: {
      mobileNumber: '',
      emailAddress: '',
      facebookProfile: '',
    },
    currentAddress: {
      houseNoStreet: '',
      barangay: '',
      municipalityCity: '',
      province: '',
      zipCode: '',
    },
    permanentAddress: {
      sameAsCurrent: true,
      houseNoStreet: '',
      barangay: '',
      municipalityCity: '',
      province: '',
      zipCode: '',
    },
    government: {
      philSysNationalIdNumber: '',
      sssNumber: '',
      philHealthNumber: '',
      pagibigNumber: '',
      tinNumber: '',
      passportNumber: '',
    },
    eligibility: {
      legallyEligible: 'Yes',
      validGovernmentId: 'Yes',
      willingToWork: ['Within Municipality'],
    },
    pwd: {
      isPersonWithDisability: 'No',
      disabilityType: '',
      disabilityTypes: [],
    },
    specialCategories: {
      fourPsBeneficiary: false,
      indigenousPeople: false,
      soloParent: false,
      seniorCitizen: false,
      returningOfw: false,
    },
    emergency: {
      fullName: '',
      relationship: '',
      contactNumber: '',
      address: '',
    },
    education: {
      highestEducationalAttainment: '',
      schoolName: '',
      courseProgram: '',
      yearGraduated: '',
      honorsAwards: '',
    },
    employment: {
      employmentStatus: 'Employment',
      desiredPosition: '',
      preferredIndustry: '',
      expectedSalary: '',
      yearsOfExperience: '',
    },
    skills: {
      technicalSkills: '',
      softSkills: '',
      languageSpoken: '',
      computerSkills: '',
      certificationsLicense: '',
    },
    documents: {
      resumeAttached: false,
      validIdAttached: false,
      certificateAttached: false,
      otherDocumentsAttached: false,
    },
  }
}

export function cloneForm(form) {
  return JSON.parse(JSON.stringify(form))
}

export function toggleArrayValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export function normalizeSectionFieldValue(section, field, value) {
  const fieldKey = `${section}.${field}`

  if (fieldKey === 'employment.expectedSalary') {
    return formatSalaryInput(value)
  }

  if (fieldKey === 'employment.yearsOfExperience') {
    return String(value ?? '').replace(/\D/g, '')
  }

  if (typeof value === 'string' && uppercaseTextFieldSet.has(fieldKey)) {
    return value.toUpperCase()
  }

  return value
}

export function buildDisabilityType(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

export function buildMember(form, id = `member-${Date.now()}`) {
  const disabilityTypes = Array.isArray(form.pwd?.disabilityTypes) ? form.pwd.disabilityTypes : []

  return {
    id,
    personal: {
      ...form.personal,
      age: calculateAge(form.personal.dateOfBirth),
    },
    contact: { ...form.contact },
    currentAddress: { ...form.currentAddress },
    permanentAddress: {
      ...form.permanentAddress,
      sameAsCurrent: form.permanentAddress.sameAsCurrent,
      ...(form.permanentAddress.sameAsCurrent ? { ...form.currentAddress } : {}),
    },
    government: { ...form.government },
    eligibility: {
      ...form.eligibility,
      willingToWork: [...form.eligibility.willingToWork],
    },
    pwd: {
      isPersonWithDisability: disabilityTypes.length > 0 ? 'Yes' : 'No',
      disabilityType: buildDisabilityType(disabilityTypes),
    },
    specialCategories: { ...form.specialCategories },
    emergency: { ...form.emergency },
    education: { ...form.education },
    employment: { ...form.employment },
    skills: { ...form.skills },
    documents: { ...form.documents },
  }
}

export function hydrateFormFromMember(member) {
  const nextForm = cloneForm(member)
  nextForm.personal.age = calculateAge(nextForm.personal.dateOfBirth)
  nextForm.employment.expectedSalary = formatSalaryInput(nextForm.employment.expectedSalary)
  nextForm.employment.yearsOfExperience = String(nextForm.employment.yearsOfExperience ?? '').replace(/\D/g, '')
  nextForm.pwd = {
    ...nextForm.pwd,
    disabilityTypes: nextForm.pwd?.disabilityType
      ? String(nextForm.pwd.disabilityType)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  }
  return nextForm
}

const specialCategorySearchLabels = {
  fourPsBeneficiary: '4Ps beneficiary',
  indigenousPeople: 'Indigenous people',
  soloParent: 'Solo parent',
  seniorCitizen: 'Senior citizen',
  returningOfw: 'Returning OFW',
}

export function getMemberSearchText(member) {
  const documents = documentOptions
    .filter(([field]) => member.documents?.[field])
    .map(([, label]) => label)

  return [
    member.id,
    member.createdAt,
    member.updatedAt,
    member.personal?.lastName,
    member.personal?.firstName,
    member.personal?.middleName,
    member.personal?.suffix,
    member.personal?.sex,
    formatSex(member.personal?.sex),
    member.personal?.dateOfBirth,
    member.personal?.placeOfBirth,
    member.personal?.age,
    member.personal?.civilStatus,
    member.personal?.nationality,
    member.personal?.religion,
    member.contact?.mobileNumber,
    member.contact?.emailAddress,
    member.contact?.facebookProfile,
    member.currentAddress?.houseNoStreet,
    member.currentAddress?.barangay,
    member.currentAddress?.municipalityCity,
    member.currentAddress?.province,
    member.currentAddress?.zipCode,
    member.permanentAddress?.houseNoStreet,
    member.permanentAddress?.barangay,
    member.permanentAddress?.municipalityCity,
    member.permanentAddress?.province,
    member.permanentAddress?.zipCode,
    member.government?.philSysNationalIdNumber,
    member.government?.sssNumber,
    member.government?.philHealthNumber,
    member.government?.pagibigNumber,
    member.government?.tinNumber,
    member.government?.passportNumber,
    member.eligibility?.legallyEligible,
    member.eligibility?.validGovernmentId,
    Array.isArray(member.eligibility?.willingToWork) ? member.eligibility.willingToWork.join(' ') : '',
    member.pwd?.isPersonWithDisability,
    member.pwd?.disabilityType,
    Object.entries(member.specialCategories ?? {})
      .filter(([, isEnabled]) => isEnabled)
      .map(([field]) => specialCategorySearchLabels[field] ?? field),
    member.emergency?.fullName,
    member.emergency?.relationship,
    member.emergency?.contactNumber,
    member.emergency?.address,
    member.education?.highestEducationalAttainment,
    member.education?.schoolName,
    member.education?.courseProgram,
    member.education?.yearGraduated,
    member.education?.honorsAwards,
    member.employment?.employmentStatus,
    member.employment?.desiredPosition,
    member.employment?.preferredIndustry,
    member.employment?.expectedSalary,
    member.employment?.yearsOfExperience,
    member.skills?.technicalSkills,
    member.skills?.softSkills,
    member.skills?.languageSpoken,
    member.skills?.computerSkills,
    member.skills?.certificationsLicense,
    documents,
  ]
    .flat()
    .map(normalizeSearchValue)
    .join(' ')
}

const exportCategoryLabels = {
  fourPsBeneficiary: '4Ps beneficiary',
  indigenousPeople: 'Indigenous people',
  soloParent: 'Solo parent',
  seniorCitizen: 'Senior citizen',
  returningOfw: 'Returning OFW',
}

// Keeps the first YYYY-MM-DD of a value so Excel dates are stable and sortable.
function toDateOnly(value) {
  if (value === undefined || value === null) {
    return ''
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : String(value)
}

export function flattenMemberForExport(member) {
  const selectedCategories = Object.entries(member.specialCategories ?? {})
    .filter(([, isEnabled]) => isEnabled)
    .map(([field]) => exportCategoryLabels[field] ?? field)

  return {
    ID: member.id,
    'Date Registered': toDateOnly(member.createdAt),
    'Date Updated': toDateOnly(member.updatedAt),
    'Last Name': member.personal?.lastName ?? '',
    'First Name': member.personal?.firstName ?? '',
    'Middle Name': member.personal?.middleName ?? '',
    Suffix: member.personal?.suffix ?? '',
    Sex: formatSex(member.personal?.sex),
    'Date of Birth': member.personal?.dateOfBirth ?? '',
    'Place of Birth': member.personal?.placeOfBirth ?? '',
    Age: member.personal?.age ?? '',
    'Civil Status': member.personal?.civilStatus ?? '',
    Nationality: member.personal?.nationality ?? '',
    Religion: member.personal?.religion ?? '',
    'Mobile Number': member.contact?.mobileNumber ?? '',
    'Email Address': member.contact?.emailAddress ?? '',
    'Facebook Profile': member.contact?.facebookProfile ?? '',
    'Current Purok / House No. / Street': member.currentAddress?.houseNoStreet ?? '',
    'Current Barangay': member.currentAddress?.barangay ?? '',
    'Current Municipality / City': member.currentAddress?.municipalityCity ?? '',
    'Current Province': member.currentAddress?.province ?? '',
    'Current ZIP Code': member.currentAddress?.zipCode ?? '',
    'Permanent Purok / House No. / Street': member.permanentAddress?.houseNoStreet ?? '',
    'Permanent Barangay': member.permanentAddress?.barangay ?? '',
    'Permanent Municipality / City': member.permanentAddress?.municipalityCity ?? '',
    'Permanent Province': member.permanentAddress?.province ?? '',
    'Permanent ZIP Code': member.permanentAddress?.zipCode ?? '',
    'Same as Current Address': formatYesNo(member.permanentAddress?.sameAsCurrent),
    'PhilSys National ID Number': member.government?.philSysNationalIdNumber ?? '',
    'SSS Number': member.government?.sssNumber ?? '',
    'PhilHealth Number': member.government?.philHealthNumber ?? '',
    'Pag-IBIG Number': member.government?.pagibigNumber ?? '',
    'TIN Number': member.government?.tinNumber ?? '',
    'Passport Number': member.government?.passportNumber ?? '',
    'Legally Eligible': member.eligibility?.legallyEligible ?? '',
    'Valid Government ID': member.eligibility?.validGovernmentId ?? '',
    'Willing To Work': Array.isArray(member.eligibility?.willingToWork) ? member.eligibility.willingToWork.join(', ') : '',
    'Person With Disability': member.pwd?.isPersonWithDisability ?? '',
    'Disability Type': member.pwd?.disabilityType ?? '',
    'Special Categories': selectedCategories.join(', '),
    'Emergency Full Name': member.emergency?.fullName ?? '',
    'Emergency Relationship': member.emergency?.relationship ?? '',
    'Emergency Contact Number': member.emergency?.contactNumber ?? '',
    'Emergency Address': member.emergency?.address ?? '',
    'Highest Educational Attainment': member.education?.highestEducationalAttainment ?? '',
    'School Name': member.education?.schoolName ?? '',
    'Course / Program': member.education?.courseProgram ?? '',
    'Year Graduated': member.education?.yearGraduated ?? '',
    'Honors / Awards': member.education?.honorsAwards ?? '',
    'Employment Status': member.employment?.employmentStatus ?? '',
    'Desired Position': member.employment?.desiredPosition ?? '',
    'Preferred Industry': member.employment?.preferredIndustry ?? '',
    'Expected Salary': member.employment?.expectedSalary ?? '',
    'Years of Experience': member.employment?.yearsOfExperience ?? '',
    'Technical Skills': member.skills?.technicalSkills ?? '',
    'Soft Skills': member.skills?.softSkills ?? '',
    'Languages Spoken': member.skills?.languageSpoken ?? '',
    'Computer Skills': member.skills?.computerSkills ?? '',
    'Certifications / Licenses': member.skills?.certificationsLicense ?? '',
    Documents: documentOptions
      .filter(([field]) => member.documents?.[field])
      .map(([, label]) => label)
      .join(', '),
  }
}

export function emptyMemberForExport() {
  return {
    id: '',
    createdAt: '',
    updatedAt: '',
    personal: {},
    contact: {},
    currentAddress: {},
    permanentAddress: {},
    government: {},
    eligibility: {},
    pwd: {},
    specialCategories: {},
    emergency: {},
    education: {},
    employment: {},
    skills: {},
    documents: {},
  }
}

const MAX_EXPORT_COLUMN_WIDTH = 45

function getExportColumnWidth(header, rows) {
  const longestCell = rows.reduce((longest, row) => {
    const value = row[header]
    const length = value === undefined || value === null ? 0 : String(value).length
    return Math.max(longest, length)
  }, 0)
  return Math.min(MAX_EXPORT_COLUMN_WIDTH, Math.max(header.length, longestCell) + 2)
}

export async function exportMembersToExcel(members, fileName) {
  const XLSX = await import('xlsx')
  const rows = members.map(flattenMemberForExport)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : Object.keys(flattenMemberForExport(emptyMemberForExport()))
  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([headers])

  const range = worksheet['!ref']
  worksheet['!cols'] = headers.map((header) => ({ wch: getExportColumnWidth(header, rows) }))
  if (range) {
    worksheet['!autofilter'] = { ref: range }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members')
  XLSX.writeFile(workbook, fileName)
}
