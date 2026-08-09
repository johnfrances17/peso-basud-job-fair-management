import {
  formatDisplayDate,
  formatSex,
  getCategoryLabels,
  getCategorySummary,
} from '../lib/format.js'
import DocumentsSection from './DocumentsSection.jsx'
import { DetailSection } from './ui.jsx'

export default function ApplicantDetails({ member, authToken }) {
  return (
    <div className="detail-view">
      <section className="detail-hero panel">
        <div className="detail-hero-copy">
          <p className="eyebrow">{getCategorySummary(member)}</p>
          <h3>{member.personal.lastName}, {member.personal.firstName} {member.personal.middleName ? `${member.personal.middleName} ` : ''}{member.personal.suffix || ''}</h3>
          <p>Registered: {formatDisplayDate(member.createdAt)}</p>
        </div>
      </section>

      <DetailSection title="Personal Information" items={[
        ['Date Signed', formatDisplayDate(member.createdAt)],
        ['Date of Birth', member.personal.dateOfBirth],
        ['Age', member.personal.age],
        ['Sex', formatSex(member.personal.sex)],
        ['Civil Status', member.personal.civilStatus],
        ['Nationality', member.personal.nationality],
        ['Religion', member.personal.religion],
        ['Place of Birth', member.personal.placeOfBirth],
      ]} />

      <DetailSection title="Contact Information" items={[
        ['Mobile Number', member.contact.mobileNumber],
        ['Email Address', member.contact.emailAddress],
        ['Facebook Profile', member.contact.facebookProfile],
      ]} />

      <DetailSection title="Current Address" items={[
        ['Purok / House No. / Street', member.currentAddress.houseNoStreet],
        ['Barangay', member.currentAddress.barangay],
        ['Municipality / City', member.currentAddress.municipalityCity],
        ['Province', member.currentAddress.province],
        ['ZIP Code', member.currentAddress.zipCode],
      ]} />

      <DetailSection title="Permanent Address" items={[
        ['Same as Current Address', member.permanentAddress.sameAsCurrent ? 'Yes' : 'No'],
        ['Purok / House No. / Street', member.permanentAddress.houseNoStreet],
        ['Barangay', member.permanentAddress.barangay],
        ['Municipality / City', member.permanentAddress.municipalityCity],
        ['Province', member.permanentAddress.province],
        ['ZIP Code', member.permanentAddress.zipCode],
      ]} />

      <DetailSection title="Government Information" items={[
        ['PhilSys National ID Number', member.government.philSysNationalIdNumber],
        ['SSS Number', member.government.sssNumber],
        ['PhilHealth Number', member.government.philHealthNumber],
        ['Pag-IBIG Number', member.government.pagibigNumber],
        ['TIN Number', member.government.tinNumber],
        ['Passport Number', member.government.passportNumber],
      ]} />

      <DetailSection title="Eligibility" items={[
        ['Legally Eligible', member.eligibility.legallyEligible],
        ['Valid Government ID', member.eligibility.validGovernmentId],
        ['Willing To Work', Array.isArray(member.eligibility.willingToWork) ? member.eligibility.willingToWork.join(', ') : '-'],
      ]} />

      <DetailSection title="PWD Information" items={[
        ['Person With Disability', member.pwd.isPersonWithDisability],
        ['Disability', member.pwd.disabilityType || '-'],
      ]} />

      <DetailSection title="Special Categories" items={[
        ['Categories', getCategoryLabels(member).join(', ') || 'Not specified'],
      ]} />

      <DetailSection title="Emergency Contact" items={[
        ['Full Name', member.emergency.fullName],
        ['Relationship', member.emergency.relationship],
        ['Contact Number', member.emergency.contactNumber],
        ['Address', member.emergency.address],
      ]} />

      <DetailSection title="Educational Background" items={[
        ['Highest Educational Attainment', member.education.highestEducationalAttainment],
        ['School Name', member.education.schoolName],
        ['Course / Program', member.education.courseProgram],
        ['Year Graduated', member.education.yearGraduated],
        ['Honors / Awards', member.education.honorsAwards],
      ]} />

      <DetailSection title="Employment Information" items={[
        ['Employment Status', member.employment.employmentStatus],
        ['Desired Position', member.employment.desiredPosition],
        ['Preferred Industry', member.employment.preferredIndustry],
        ['Expected Salary', member.employment.expectedSalary],
        ['Years of Experience', member.employment.yearsOfExperience],
      ]} />

      <DetailSection title="Skills and Documents" items={[
        ['Technical Skills', member.skills.technicalSkills],
        ['Soft Skills', member.skills.softSkills],
        ['Languages Spoken', member.skills.languageSpoken],
        ['Computer Skills', member.skills.computerSkills],
        ['Certifications / Licenses', member.skills.certificationsLicense],
      ]} />

      <DocumentsSection
        memberId={member.id}
        authToken={authToken}
        physicalDocuments={member.documents}
        readOnly
      />
    </div>
  )
}
