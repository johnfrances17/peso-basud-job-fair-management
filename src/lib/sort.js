import { formatSex, formatTableAddress, getCategorySummary } from './format.js'

// Natural, case-insensitive string comparison ("Purok 2" sorts before
// "Purok 10").
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function sortValue(member, key) {
  switch (key) {
    case 'name':
      return `${member.personal?.lastName ?? ''}, ${member.personal?.firstName ?? ''} ${member.personal?.middleName ?? ''}`.trim()

    case 'age': {
      const age = Number(member.personal?.age)
      const hasAge = member.personal?.age !== '' && member.personal?.age != null && Number.isFinite(age)
      return hasAge ? age : null
    }

    case 'gender':
      return formatSex(member.personal?.sex)

    case 'address':
      return formatTableAddress(member.currentAddress)

    case 'contact': {
      const contact = member.contact?.mobileNumber || member.contact?.emailAddress || ''
      return contact.toLowerCase()
    }

    case 'category':
      return getCategorySummary(member)

    case 'dateSigned': {
      const timestamp = member.createdAt ? new Date(member.createdAt).getTime() : Number.NaN
      return Number.isNaN(timestamp) ? null : timestamp
    }

    default:
      return ''
  }
}

export function sortMembers(members, sortKey, direction = 'asc') {
  if (!sortKey || !members || members.length < 2) {
    return members
  }

  const multiplier = direction === 'desc' ? -1 : 1

  return [...members].sort((memberA, memberB) => {
    const valueA = sortValue(memberA, sortKey)
    const valueB = sortValue(memberB, sortKey)

    // Missing values always sort to the end, regardless of direction.
    if (valueA === null || valueA === '') {
      return 1
    }
    if (valueB === null || valueB === '') {
      return -1
    }

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return (valueA - valueB) * multiplier
    }

    return collator.compare(String(valueA), String(valueB)) * multiplier
  })
}
