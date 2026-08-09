import { describe, expect, it } from 'vitest'
import { formatSex, formatTableAddress } from '../src/lib/format.js'

describe('formatSex', () => {
  it('expands the stored M/F codes to full labels', () => {
    expect(formatSex('M')).toBe('Male')
    expect(formatSex('F')).toBe('Female')
  })

  it('passes full labels through untouched', () => {
    expect(formatSex('Male')).toBe('Male')
    expect(formatSex('Female')).toBe('Female')
  })

  it('handles missing and empty values', () => {
    expect(formatSex('')).toBe('-')
    expect(formatSex(undefined)).toBe('-')
    expect(formatSex(null)).toBe('-')
  })

  it('trims whitespace around the code', () => {
    expect(formatSex(' M ')).toBe('Male')
  })
})

describe('formatTableAddress', () => {
  it('lists barangay first without the purok / house no. / street', () => {
    const address = {
      houseNoStreet: 'Purok 1, Sitio Malaya',
      barangay: 'Bactas',
      municipalityCity: 'Basud',
      province: 'Camarines Norte',
    }

    expect(formatTableAddress(address)).toBe('Brgy. Bactas, Basud, Camarines Norte')
  })

  it('does not leak placeholder dashes into the summary', () => {
    const address = {
      houseNoStreet: '-',
      barangay: 'Bactas',
      municipalityCity: 'Basud',
      province: 'Camarines Norte',
    }

    expect(formatTableAddress(address)).toBe('Brgy. Bactas, Basud, Camarines Norte')
  })

  it('treats n/a and na as missing values', () => {
    const address = {
      houseNoStreet: '',
      barangay: 'N/A',
      municipalityCity: 'Na',
      province: '',
    }

    expect(formatTableAddress(address)).toBe('-')
  })

  it('returns a dash when every part is empty', () => {
    expect(formatTableAddress({})).toBe('-')
    expect(formatTableAddress(undefined)).toBe('-')
  })
})
