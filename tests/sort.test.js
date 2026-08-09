import { describe, expect, it } from 'vitest'
import { sortMembers } from '../src/lib/sort.js'

function member(overrides = {}) {
  return {
    id: Math.random(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    personal: {
      lastName: 'Zulu',
      firstName: 'Anna',
      middleName: '',
      sex: 'M',
      age: '30',
    },
    contact: {
      mobileNumber: '',
      emailAddress: '',
    },
    currentAddress: {
      houseNoStreet: '',
      barangay: '',
      municipalityCity: '',
      province: '',
    },
    specialCategories: {},
    ...overrides,
  }
}

describe('sortMembers', () => {
  const members = [
    member({
      personal: { lastName: 'Zulu', firstName: 'Anna', sex: 'M', age: '30' },
      createdAt: '2026-03-01T00:00:00.000Z',
      currentAddress: { barangay: 'Bactas', municipalityCity: 'Basud', province: 'Camarines Norte' },
    }),
    member({
      personal: { lastName: 'Abad', firstName: 'Bea', sex: 'F', age: '25' },
      createdAt: '2026-01-01T00:00:00.000Z',
      currentAddress: { barangay: 'Angas', municipalityCity: 'Basud', province: 'Camarines Norte' },
    }),
    member({
      personal: { lastName: 'Cruz', firstName: 'Carlo', sex: 'M', age: '' },
      createdAt: '2026-02-01T00:00:00.000Z',
      currentAddress: { barangay: 'San Pablo', municipalityCity: 'Basud', province: 'Camarines Norte' },
    }),
  ]

  it('sorts by name ascending and does not mutate the input', () => {
    const result = sortMembers(members, 'name', 'asc')
    expect(result.map((item) => item.personal.lastName)).toEqual(['Abad', 'Cruz', 'Zulu'])
    expect(members.map((item) => item.personal.lastName)).toEqual(['Zulu', 'Abad', 'Cruz'])
  })

  it('sorts by name descending', () => {
    const result = sortMembers(members, 'name', 'desc')
    expect(result.map((item) => item.personal.lastName)).toEqual(['Zulu', 'Cruz', 'Abad'])
  })

  it('sorts by age numerically with missing ages last', () => {
    const result = sortMembers(members, 'age', 'asc')
    expect(result.map((item) => item.personal.age)).toEqual(['25', '30', ''])
  })

  it('sorts by gender using the formatted labels', () => {
    const result = sortMembers(members, 'gender', 'asc')
    expect(result.map((item) => item.personal.sex)).toEqual(['F', 'M', 'M'])
  })

  it('sorts by address using the barangay-first table format', () => {
    const result = sortMembers(members, 'address', 'asc')
    expect(result.map((item) => item.currentAddress.barangay)).toEqual(['Angas', 'Bactas', 'San Pablo'])
  })

  it('sorts by date signed as a date', () => {
    const result = sortMembers(members, 'dateSigned', 'asc')
    expect(result.map((item) => item.createdAt.slice(5, 7))).toEqual(['01', '02', '03'])
  })

  it('returns the list unchanged without a sort key', () => {
    expect(sortMembers(members, null)).toBe(members)
  })

  it('returns the list unchanged for a single row', () => {
    expect(sortMembers([members[0]], 'name')).toEqual([members[0]])
  })
})
