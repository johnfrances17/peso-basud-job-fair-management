import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../server/app.js'

let authToken = ''

async function login() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'staff@basud.local', password: 'Basud1234' })
  authToken = response.body.token
  return authToken
}

function authorized() {
  return new Proxy(request(app), {
    get(target, prop) {
      const value = target[prop]
      if (typeof value === 'function') {
        return (path) => value(path).set('Authorization', `Bearer ${authToken}`)
      }
      return value
    },
  })
}

function minimalMember(overrides = {}) {
  return {
    personal: {
      lastName: 'Torres',
      firstName: 'Ramon',
      middleName: '',
      suffix: '',
      sex: 'M',
      dateOfBirth: '1992-09-21',
      placeOfBirth: '',
      age: 33,
      civilStatus: 'Married',
      nationality: 'Filipino',
      religion: '',
    },
    contact: { mobileNumber: '09178886666', emailAddress: 'ramon.torres@example.com', facebookProfile: '' },
    currentAddress: { houseNoStreet: '', barangay: 'Bactas', municipalityCity: 'Basud', province: 'Camarines Norte', zipCode: '4608' },
    permanentAddress: { sameAsCurrent: true },
    government: {},
    eligibility: { legallyEligible: 'Yes', validGovernmentId: 'Yes', willingToWork: ['Within Municipality'] },
    pwd: { isPersonWithDisability: 'No', disabilityType: '' },
    specialCategories: {
      fourPsBeneficiary: false,
      indigenousPeople: false,
      soloParent: false,
      seniorCitizen: false,
      returningOfw: false,
    },
    emergency: {},
    education: {},
    employment: { employmentStatus: 'Unemployed' },
    skills: {},
    documents: {},
    ...overrides,
  }
}

describe('member validation and duplicates', () => {
  it('rejects a member without a last name', async () => {
    await login()

    const response = await authorized()
      .post('/api/members')
      .send(minimalMember({ personal: { ...minimalMember().personal, lastName: '   ' } }))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/last name/i)
  })

  it('rejects a member without a first name', async () => {
    await login()

    const response = await authorized()
      .post('/api/members')
      .send(minimalMember({ personal: { ...minimalMember().personal, firstName: '' } }))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/first name/i)
  })

  it('rejects an invalid sex value', async () => {
    await login()

    const response = await authorized()
      .post('/api/members')
      .send(minimalMember({ personal: { ...minimalMember().personal, sex: 'X' } }))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/sex/i)
  })

  it('rejects an invalid civil status value', async () => {
    await login()

    const response = await authorized()
      .post('/api/members')
      .send(minimalMember({ personal: { ...minimalMember().personal, civilStatus: 'Engaged' } }))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/civil status/i)
  })

  it('rejects an invalid willing-to-work scope', async () => {
    await login()

    const response = await authorized()
      .post('/api/members')
      .send(minimalMember({
        eligibility: { ...minimalMember().eligibility, willingToWork: ['The Moon'] },
      }))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/willing-to-work/i)
  })

  it('flags a possible duplicate on create', async () => {
    await login()

    const firstResponse = await authorized().post('/api/members').send(minimalMember())
    expect(firstResponse.status).toBe(201)
    expect(firstResponse.body.duplicates).toHaveLength(0)

    // Same name and birth date but a different contact number.
    const duplicateResponse = await authorized().post('/api/members').send(minimalMember({
      contact: { ...minimalMember().contact, mobileNumber: '09178889999' },
    }))

    expect(duplicateResponse.status).toBe(201)
    expect(duplicateResponse.body.duplicates).toHaveLength(1)
    expect(duplicateResponse.body.duplicates[0].id).toBe(firstResponse.body.member.id)

    // Same mobile number on a different person is also flagged.
    const mobileDuplicateResponse = await authorized().post('/api/members').send(minimalMember({
      personal: { ...minimalMember().personal, lastName: 'Villanueva', firstName: 'Carla', dateOfBirth: '1990-01-01' },
      contact: { ...minimalMember().contact, mobileNumber: '09178886666' },
    }))

    expect(mobileDuplicateResponse.status).toBe(201)
    expect(mobileDuplicateResponse.body.duplicates.some((entry) => entry.id === firstResponse.body.member.id)).toBe(true)
  })

  it('rejects an exact duplicate payload on create', async () => {
    await login()

    const uniqueMember = minimalMember({
      personal: { ...minimalMember().personal, lastName: 'Zulueta', firstName: 'Nadia', dateOfBirth: '1985-03-14' },
      contact: { ...minimalMember().contact, mobileNumber: '09179995555', emailAddress: 'nadia.zulueta@example.com' },
    })

    const firstResponse = await authorized().post('/api/members').send(uniqueMember)
    expect(firstResponse.status).toBe(201)

    // Identical payload — e.g. a double-clicked Save — must not create a second row.
    const duplicateResponse = await authorized().post('/api/members').send(uniqueMember)
    expect(duplicateResponse.status).toBe(409)
    expect(duplicateResponse.body.message).toMatch(/already exists/i)
  })

  it('does not flag the member itself as a duplicate on update', async () => {
    await login()

    const uniqueMember = minimalMember({
      personal: { ...minimalMember().personal, lastName: 'Salazar', firstName: 'Miguel', dateOfBirth: '1988-12-05' },
      contact: { ...minimalMember().contact, mobileNumber: '09175554444', emailAddress: 'miguel.salazar@example.com' },
    })
    const createResponse = await authorized().post('/api/members').send(uniqueMember)
    const memberId = createResponse.body.member.id

    const updateResponse = await authorized()
      .put(`/api/members/${memberId}`)
      .send({ ...uniqueMember, personal: { ...uniqueMember.personal, religion: 'Iglesia Ni Cristo' } })

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.duplicates).toHaveLength(0)
  })
})
