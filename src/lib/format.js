import { fieldPlaceholders } from './constants.js'

export function getPlaceholder(section, field) {
  return fieldPlaceholders[`${section}.${field}`] ?? ''
}

export function formatDisplayDate(value) {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

const sexLabels = {
  M: 'Male',
  F: 'Female',
}

export function formatSex(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized) {
    return '-'
  }

  return sexLabels[normalized] ?? normalized
}

// Values that only look like data (placeholder dashes, N/A) are treated as
// empty so address summaries never render things like "-, Brgy. Bactas".
function isMeaningfulAddressPart(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized !== '' && normalized !== '-' && normalized !== 'n/a' && normalized !== 'na'
}

// Compact address for the table list: Barangay first, without the
// Purok / house no. / street detail (that stays in the full record view).
export function formatTableAddress(address = {}) {
  const parts = [
    isMeaningfulAddressPart(address.barangay) ? `Brgy. ${String(address.barangay).trim()}` : '',
    isMeaningfulAddressPart(address.municipalityCity) ? String(address.municipalityCity).trim() : '',
    isMeaningfulAddressPart(address.province) ? String(address.province).trim() : '',
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : '-'
}

export function getCategoryLabels(member) {
  const labels = {
    fourPsBeneficiary: '4Ps',
    indigenousPeople: 'Indigenous',
    soloParent: 'Solo Parent',
    seniorCitizen: 'Senior Citizen',
    returningOfw: 'Returning OFW',
  }

  return Object.entries(member.specialCategories ?? {})
    .filter(([, isEnabled]) => isEnabled)
    .map(([field]) => labels[field] ?? field)
}

export function getCategorySummary(member) {
  const labels = getCategoryLabels(member)
  return labels.length > 0 ? labels.join(', ') : 'Not specified'
}

export function formatYesNo(value) {
  return value ? 'Yes' : 'No'
}

export function normalizeSearchValue(value) {
  return String(value ?? '').toLowerCase()
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return ''
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) {
    return ''
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age >= 0 ? String(age) : ''
}

export function formatSalaryInput(value) {
  const digitsOnly = String(value ?? '').replace(/\D/g, '')

  if (!digitsOnly) {
    return ''
  }

  return `PHP ${new Intl.NumberFormat('en-PH').format(Number(digitsOnly))}`
}
