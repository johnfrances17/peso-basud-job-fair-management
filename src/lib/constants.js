export const membersPerPage = 10

export const authStorageKey = 'basud-staff-token'
export const summaryColumnVisibilityStorageKey = 'basud-summary-table-column-visibility'

export const summaryColumnOptions = [
  ['name', 'Name'],
  ['age', 'Age'],
  ['gender', 'Gender'],
  ['address', 'Address'],
  ['contact', 'Contact'],
  ['category', 'Category'],
  ['dateSigned', 'Date Signed'],
]

export const defaultSummaryColumnVisibility = {
  name: true,
  age: true,
  gender: true,
  address: true,
  contact: true,
  category: true,
  dateSigned: true,
}

export const documentOptions = [
  ['resumeAttached', 'Resume'],
  ['validIdAttached', 'Valid ID'],
  ['certificateAttached', 'Certificate/s'],
  ['otherDocumentsAttached', 'Other Documents'],
]

export const eligibilityOptions = ['Yes', 'No']

export const willingToWorkOptions = [
  'Within Municipality',
  'Within Province',
  'Anywhere in the Philippines',
  'Overseas',
]

export const specialCategoryOptions = [
  ['fourPsBeneficiary', '4Ps Beneficiary'],
  ['indigenousPeople', 'Indigenous People (IP)'],
  ['soloParent', 'Solo Parent'],
  ['seniorCitizen', 'Senior Citizen'],
  ['returningOfw', 'Returning OFW'],
]

export const highestEducationalAttainmentOptions = [
  'No Formal Education',
  'Elementary Level',
  'Elementary Graduate',
  'High School Level',
  'High School Graduate',
  'College Level',
  'College Graduate',
  'Vocational / Technical',
  'Post Graduate',
]

export const disabilityOptions = ['Visual', 'Speech', 'Mental', 'Hearing', 'Physical', 'Others']

export const employmentStatusOptions = [
  'Employment',
  'Unemployed',
  'Self-Employed',
  'Student',
  'Fresh Graduate',
]

export const uppercaseTextFieldSet = new Set([
  'personal.lastName',
  'personal.firstName',
  'personal.middleName',
  'personal.suffix',
  'personal.placeOfBirth',
  'personal.nationality',
  'personal.religion',
  'contact.mobileNumber',
  'currentAddress.houseNoStreet',
  'currentAddress.barangay',
  'currentAddress.municipalityCity',
  'currentAddress.province',
  'currentAddress.zipCode',
  'permanentAddress.houseNoStreet',
  'permanentAddress.barangay',
  'permanentAddress.municipalityCity',
  'permanentAddress.province',
  'permanentAddress.zipCode',
  'government.philSysNationalIdNumber',
  'government.sssNumber',
  'government.philHealthNumber',
  'government.pagibigNumber',
  'government.tinNumber',
  'government.passportNumber',
  'emergency.fullName',
  'emergency.relationship',
  'emergency.contactNumber',
  'emergency.address',
  'education.schoolName',
  'education.courseProgram',
  'education.yearGraduated',
  'education.honorsAwards',
  'employment.desiredPosition',
  'employment.preferredIndustry',
  'skills.technicalSkills',
  'skills.softSkills',
  'skills.languageSpoken',
  'skills.computerSkills',
  'skills.certificationsLicense',
])

export const fieldPlaceholders = {
  'personal.lastName': 'Enter last name',
  'personal.firstName': 'Enter first name',
  'personal.middleName': 'Enter middle name',
  'personal.suffix': 'Enter suffix, if any',
  'personal.dateOfBirth': 'YYYY-MM-DD',
  'personal.placeOfBirth': 'Enter place of birth',
  'personal.age': 'Enter age',
  'personal.nationality': 'Enter nationality',
  'personal.religion': 'Enter religion',
  'contact.mobileNumber': 'Enter mobile number',
  'contact.emailAddress': 'Enter email address',
  'contact.facebookProfile': 'Enter Facebook profile link or username',
  'currentAddress.houseNoStreet': 'Enter house no. and street',
  'currentAddress.barangay': 'Enter barangay',
  'currentAddress.municipalityCity': 'Enter municipality or city',
  'currentAddress.province': 'Enter province',
  'currentAddress.zipCode': 'Enter ZIP code',
  'permanentAddress.houseNoStreet': 'Enter house no. and street',
  'permanentAddress.barangay': 'Enter barangay',
  'permanentAddress.municipalityCity': 'Enter municipality or city',
  'permanentAddress.province': 'Enter province',
  'permanentAddress.zipCode': 'Enter ZIP code',
  'government.philSysNationalIdNumber': 'Enter PhilSys ID number',
  'government.sssNumber': 'Enter SSS number',
  'government.philHealthNumber': 'Enter PhilHealth number',
  'government.pagibigNumber': 'Enter Pag-IBIG number',
  'government.tinNumber': 'Enter TIN number',
  'government.passportNumber': 'Enter passport number',
  'employment.yearsOfExperience': 'Enter years of experience',
  'skills.languageSpoken': 'Enter languages spoken',
  'skills.computerSkills': 'Enter computer skills',
  'skills.certificationsLicense': 'Enter certifications or licenses',
  'pwd.disabilityType': 'Enter disability type, if applicable',
  'emergency.fullName': 'Enter full name',
  'emergency.relationship': 'Enter relationship',
  'emergency.contactNumber': 'Enter contact number',
  'emergency.address': 'Enter complete address',
  'education.highestEducationalAttainment': 'Enter highest educational attainment',
  'education.schoolName': 'Enter school name',
  'education.courseProgram': 'Enter course or program',
  'education.yearGraduated': 'Enter year graduated',
  'education.honorsAwards': 'Enter honors or awards, if any',
  'employment.desiredPosition': 'Enter desired position',
  'employment.preferredIndustry': 'Enter preferred industry',
  'employment.expectedSalary': 'Enter expected salary',
  'skills.technicalSkills': 'List technical skills',
  'skills.softSkills': 'List soft skills',
}
