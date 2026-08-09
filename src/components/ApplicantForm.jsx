import { getPlaceholder } from '../lib/format.js'
import {
  disabilityOptions,
  documentOptions,
  eligibilityOptions,
  employmentStatusOptions,
  highestEducationalAttainmentOptions,
  specialCategoryOptions,
  willingToWorkOptions,
} from '../lib/constants.js'
import { toggleArrayValue } from '../lib/members.js'
import { FieldLabel, Notice } from './ui.jsx'

export default function ApplicantForm({ form, editingId, loadingMembers, submitNotice, onFieldChange, onSubmit, onCancel, children }) {
  return (
    <form className="member-form" onSubmit={onSubmit}>
      <fieldset className="form-section">
        <legend>Personal Information</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Last Name" required />
            <input value={form.personal.lastName} onChange={(event) => onFieldChange('personal', 'lastName', event.target.value)} required placeholder={getPlaceholder('personal', 'lastName')} />
          </label>
          <label>
            <FieldLabel text="First Name" required />
            <input value={form.personal.firstName} onChange={(event) => onFieldChange('personal', 'firstName', event.target.value)} required placeholder={getPlaceholder('personal', 'firstName')} />
          </label>
          <label>
            <FieldLabel text="Middle Name" />
            <input value={form.personal.middleName} onChange={(event) => onFieldChange('personal', 'middleName', event.target.value)} placeholder={getPlaceholder('personal', 'middleName')} />
          </label>
          <label>
            <FieldLabel text="Suffix" />
            <input value={form.personal.suffix} onChange={(event) => onFieldChange('personal', 'suffix', event.target.value)} placeholder={getPlaceholder('personal', 'suffix')} />
          </label>
          <label>
            <FieldLabel text="Sex" />
            <select value={form.personal.sex} onChange={(event) => onFieldChange('personal', 'sex', event.target.value)}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          <label>
            <FieldLabel text="Date of Birth" />
            <input type="date" value={form.personal.dateOfBirth} onChange={(event) => onFieldChange('personal', 'dateOfBirth', event.target.value)} placeholder={getPlaceholder('personal', 'dateOfBirth')} />
          </label>
          <label>
            <FieldLabel text="Age" />
            <input value={form.personal.age} readOnly disabled placeholder="Auto-calculated from Date of Birth" />
          </label>
          <label>
            <FieldLabel text="Place of Birth" />
            <input value={form.personal.placeOfBirth} onChange={(event) => onFieldChange('personal', 'placeOfBirth', event.target.value)} placeholder={getPlaceholder('personal', 'placeOfBirth')} />
          </label>
          <label>
            <FieldLabel text="Nationality" />
            <input value={form.personal.nationality} onChange={(event) => onFieldChange('personal', 'nationality', event.target.value)} placeholder={getPlaceholder('personal', 'nationality')} />
          </label>
          <label>
            <FieldLabel text="Religion" optional />
            <input value={form.personal.religion} onChange={(event) => onFieldChange('personal', 'religion', event.target.value)} placeholder={getPlaceholder('personal', 'religion')} />
          </label>
          <label>
            <FieldLabel text="Civil Status" />
            <select value={form.personal.civilStatus} onChange={(event) => onFieldChange('personal', 'civilStatus', event.target.value)}>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Contact Information</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Mobile Number" />
            <input value={form.contact.mobileNumber} onChange={(event) => onFieldChange('contact', 'mobileNumber', event.target.value)} placeholder={getPlaceholder('contact', 'mobileNumber')} />
          </label>
          <label>
            <FieldLabel text="Email Address" />
            <input type="email" value={form.contact.emailAddress} onChange={(event) => onFieldChange('contact', 'emailAddress', event.target.value)} placeholder={getPlaceholder('contact', 'emailAddress')} />
          </label>
          <label className="full-width">
            <FieldLabel text="Facebook Profile" />
            <input value={form.contact.facebookProfile} onChange={(event) => onFieldChange('contact', 'facebookProfile', event.target.value)} placeholder={getPlaceholder('contact', 'facebookProfile')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Current Address</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Purok / House No. / Street" />
            <input value={form.currentAddress.houseNoStreet} onChange={(event) => onFieldChange('currentAddress', 'houseNoStreet', event.target.value)} placeholder={getPlaceholder('currentAddress', 'houseNoStreet')} />
          </label>
          <label>
            <FieldLabel text="Barangay" required />
            <input value={form.currentAddress.barangay} onChange={(event) => onFieldChange('currentAddress', 'barangay', event.target.value)} required placeholder={getPlaceholder('currentAddress', 'barangay')} />
          </label>
          <label>
            <FieldLabel text="Municipality / City" required />
            <input value={form.currentAddress.municipalityCity} onChange={(event) => onFieldChange('currentAddress', 'municipalityCity', event.target.value)} required placeholder={getPlaceholder('currentAddress', 'municipalityCity')} />
          </label>
          <label>
            <FieldLabel text="Province" required />
            <input value={form.currentAddress.province} onChange={(event) => onFieldChange('currentAddress', 'province', event.target.value)} required placeholder={getPlaceholder('currentAddress', 'province')} />
          </label>
          <label>
            <FieldLabel text="ZIP Code" />
            <input value={form.currentAddress.zipCode} onChange={(event) => onFieldChange('currentAddress', 'zipCode', event.target.value)} placeholder={getPlaceholder('currentAddress', 'zipCode')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend><FieldLabel text="Permanent Address" emphasized /></legend>
        <label className="inline-toggle">
          <input type="checkbox" checked={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'sameAsCurrent', event.target.checked)} />
          <span>Same as Current Address</span>
        </label>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Purok / House No. / Street" />
            <input value={form.permanentAddress.sameAsCurrent ? form.currentAddress.houseNoStreet : form.permanentAddress.houseNoStreet} disabled={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'houseNoStreet', event.target.value)} placeholder={getPlaceholder('permanentAddress', 'houseNoStreet')} />
          </label>
          <label>
            <FieldLabel text="Barangay" required />
            <input value={form.permanentAddress.sameAsCurrent ? form.currentAddress.barangay : form.permanentAddress.barangay} disabled={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'barangay', event.target.value)} required placeholder={getPlaceholder('permanentAddress', 'barangay')} />
          </label>
          <label>
            <FieldLabel text="Municipality / City" required />
            <input value={form.permanentAddress.sameAsCurrent ? form.currentAddress.municipalityCity : form.permanentAddress.municipalityCity} disabled={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'municipalityCity', event.target.value)} required placeholder={getPlaceholder('permanentAddress', 'municipalityCity')} />
          </label>
          <label>
            <FieldLabel text="Province" required />
            <input value={form.permanentAddress.sameAsCurrent ? form.currentAddress.province : form.permanentAddress.province} disabled={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'province', event.target.value)} required placeholder={getPlaceholder('permanentAddress', 'province')} />
          </label>
          <label>
            <FieldLabel text="ZIP Code" />
            <input value={form.permanentAddress.sameAsCurrent ? form.currentAddress.zipCode : form.permanentAddress.zipCode} disabled={form.permanentAddress.sameAsCurrent} onChange={(event) => onFieldChange('permanentAddress', 'zipCode', event.target.value)} placeholder={getPlaceholder('permanentAddress', 'zipCode')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend><FieldLabel text="Government Information" optional emphasized /></legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="PhilSys National ID Number" />
            <input value={form.government.philSysNationalIdNumber} onChange={(event) => onFieldChange('government', 'philSysNationalIdNumber', event.target.value)} placeholder={getPlaceholder('government', 'philSysNationalIdNumber')} />
          </label>
          <label>
            <FieldLabel text="SSS Number" />
            <input value={form.government.sssNumber} onChange={(event) => onFieldChange('government', 'sssNumber', event.target.value)} placeholder={getPlaceholder('government', 'sssNumber')} />
          </label>
          <label>
            <FieldLabel text="PhilHealth Number" />
            <input value={form.government.philHealthNumber} onChange={(event) => onFieldChange('government', 'philHealthNumber', event.target.value)} placeholder={getPlaceholder('government', 'philHealthNumber')} />
          </label>
          <label>
            <FieldLabel text="Pag-IBIG Number" />
            <input value={form.government.pagibigNumber} onChange={(event) => onFieldChange('government', 'pagibigNumber', event.target.value)} placeholder={getPlaceholder('government', 'pagibigNumber')} />
          </label>
          <label>
            <FieldLabel text="TIN Number" />
            <input value={form.government.tinNumber} onChange={(event) => onFieldChange('government', 'tinNumber', event.target.value)} placeholder={getPlaceholder('government', 'tinNumber')} />
          </label>
          <label>
            <FieldLabel text="Passport Number" />
            <input value={form.government.passportNumber} onChange={(event) => onFieldChange('government', 'passportNumber', event.target.value)} placeholder={getPlaceholder('government', 'passportNumber')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Employment Eligibility</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Are you legally eligible to work in the Philippines?" required />
            <select value={form.eligibility.legallyEligible} onChange={(event) => onFieldChange('eligibility', 'legallyEligible', event.target.value)}>
              {eligibilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <FieldLabel text="Do you have a valid government-issued ID?" required />
            <select value={form.eligibility.validGovernmentId} onChange={(event) => onFieldChange('eligibility', 'validGovernmentId', event.target.value)}>
              {eligibilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="button-group checkbox-grid">
          <div className="full-width fieldset-note">Willing to work</div>
          {willingToWorkOptions.map((option) => (
            <label key={option} className="chip-option">
              <input
                type="checkbox"
                checked={form.eligibility.willingToWork.includes(option)}
                onChange={() => onFieldChange('eligibility', 'willingToWork', toggleArrayValue(form.eligibility.willingToWork, option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>PWD Information</legend>
        <div className="grid two-col">
          <div className="full-width fieldset-note">Disability</div>
          <div className="button-group checkbox-grid full-width">
            {disabilityOptions.map((option) => (
              <label key={option} className="chip-option">
                <input
                  type="checkbox"
                  checked={form.pwd.disabilityTypes.includes(option)}
                  onChange={() => onFieldChange('pwd', 'disabilityTypes', toggleArrayValue(form.pwd.disabilityTypes, option))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Special Categories</legend>
        <div className="button-group checkbox-grid">
          {specialCategoryOptions.map(([field, label]) => (
            <label key={field} className="chip-option">
              <input
                type="checkbox"
                checked={form.specialCategories[field]}
                onChange={(event) => onFieldChange('specialCategories', field, event.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Emergency Contact</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Full Name" />
            <input value={form.emergency.fullName} onChange={(event) => onFieldChange('emergency', 'fullName', event.target.value)} placeholder={getPlaceholder('emergency', 'fullName')} />
          </label>
          <label>
            <FieldLabel text="Relationship" />
            <input value={form.emergency.relationship} onChange={(event) => onFieldChange('emergency', 'relationship', event.target.value)} placeholder={getPlaceholder('emergency', 'relationship')} />
          </label>
          <label>
            <FieldLabel text="Contact Number" />
            <input value={form.emergency.contactNumber} onChange={(event) => onFieldChange('emergency', 'contactNumber', event.target.value)} placeholder={getPlaceholder('emergency', 'contactNumber')} />
          </label>
          <label className="full-width">
            <FieldLabel text="Address" />
            <input value={form.emergency.address} onChange={(event) => onFieldChange('emergency', 'address', event.target.value)} placeholder={getPlaceholder('emergency', 'address')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Educational Background</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Highest Educational Attainment" />
            <select value={form.education.highestEducationalAttainment} onChange={(event) => onFieldChange('education', 'highestEducationalAttainment', event.target.value)}>
              <option value="">Select...</option>
              {highestEducationalAttainmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <FieldLabel text="School Name" />
            <input value={form.education.schoolName} onChange={(event) => onFieldChange('education', 'schoolName', event.target.value)} placeholder={getPlaceholder('education', 'schoolName')} />
          </label>
          <label>
            <FieldLabel text="Course / Program" />
            <input value={form.education.courseProgram} onChange={(event) => onFieldChange('education', 'courseProgram', event.target.value)} placeholder={getPlaceholder('education', 'courseProgram')} />
          </label>
          <label>
            <FieldLabel text="Year Graduated" />
            <input value={form.education.yearGraduated} onChange={(event) => onFieldChange('education', 'yearGraduated', event.target.value)} placeholder={getPlaceholder('education', 'yearGraduated')} />
          </label>
          <label className="full-width">
            <FieldLabel text="Honors / Awards" optional />
            <input value={form.education.honorsAwards} onChange={(event) => onFieldChange('education', 'honorsAwards', event.target.value)} placeholder={getPlaceholder('education', 'honorsAwards')} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Employment Information</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Employment Status" required />
            <select value={form.employment.employmentStatus} onChange={(event) => onFieldChange('employment', 'employmentStatus', event.target.value)}>
              {employmentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <FieldLabel text="Desired Position" />
            <input value={form.employment.desiredPosition} onChange={(event) => onFieldChange('employment', 'desiredPosition', event.target.value)} placeholder={getPlaceholder('employment', 'desiredPosition')} />
          </label>
          <label>
            <FieldLabel text="Preferred Industry" />
            <input value={form.employment.preferredIndustry} onChange={(event) => onFieldChange('employment', 'preferredIndustry', event.target.value)} placeholder={getPlaceholder('employment', 'preferredIndustry')} />
          </label>
          <label>
            <FieldLabel text="Expected Salary" />
            <input value={form.employment.expectedSalary} onChange={(event) => onFieldChange('employment', 'expectedSalary', event.target.value)} inputMode="numeric" placeholder="PHP 0" />
          </label>
          <label className="full-width">
            <FieldLabel text="Years of Experience (Months)" />
            <input value={form.employment.yearsOfExperience} onChange={(event) => onFieldChange('employment', 'yearsOfExperience', event.target.value)} inputMode="numeric" placeholder="Enter months" />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Skills and Documents</legend>
        <div className="grid two-col">
          <label>
            <FieldLabel text="Technical Skills" />
            <textarea rows="3" value={form.skills.technicalSkills} onChange={(event) => onFieldChange('skills', 'technicalSkills', event.target.value)} placeholder={getPlaceholder('skills', 'technicalSkills')} />
          </label>
          <label>
            <FieldLabel text="Soft Skills" />
            <textarea rows="3" value={form.skills.softSkills} onChange={(event) => onFieldChange('skills', 'softSkills', event.target.value)} placeholder={getPlaceholder('skills', 'softSkills')} />
          </label>
          <label>
            <FieldLabel text="Language Spoken" />
            <input value={form.skills.languageSpoken} onChange={(event) => onFieldChange('skills', 'languageSpoken', event.target.value)} placeholder={getPlaceholder('skills', 'languageSpoken')} />
          </label>
          <label>
            <FieldLabel text="Computer Skills" />
            <input value={form.skills.computerSkills} onChange={(event) => onFieldChange('skills', 'computerSkills', event.target.value)} placeholder={getPlaceholder('skills', 'computerSkills')} />
          </label>
          <label className="full-width">
            <FieldLabel text="Certifications / Licenses" />
            <input value={form.skills.certificationsLicense} onChange={(event) => onFieldChange('skills', 'certificationsLicense', event.target.value)} placeholder={getPlaceholder('skills', 'certificationsLicense')} />
          </label>
        </div>
        <div className="button-group checkbox-grid">
          {documentOptions.map(([field, label]) => (
            <label key={field} className="chip-option">
              <input type="checkbox" checked={form.documents[field]} onChange={(event) => onFieldChange('documents', field, event.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className="fieldset-note">
          {editingId
            ? 'Mark a document as attached when a physical paper copy has been received. Digital copies can be uploaded below.'
            : 'Mark a document as attached when a physical paper copy has been received. Digital copies can be uploaded after the applicant is saved.'}
        </p>
      </fieldset>

      {children}

      <div className="actions-row modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button" disabled={loadingMembers}>{editingId ? 'Save Changes' : 'Save Applicant'}</button>
      </div>

      {submitNotice ? <Notice>{submitNotice}</Notice> : null}
    </form>
  )
}
