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
  // supertest's request(app) returns a dispatch object whose method calls
  // (get/post/put/delete) produce the Test instance that carries .set().
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

function sampleMember(overrides = {}) {
  return {
    personal: {
      lastName: 'Dela Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      suffix: '',
      sex: 'M',
      dateOfBirth: '1995-04-12',
      placeOfBirth: 'Basud, Camarines Norte',
      age: 30,
      civilStatus: 'Single',
      nationality: 'Filipino',
      religion: 'Roman Catholic',
    },
    contact: {
      mobileNumber: '09171234567',
      emailAddress: 'juan.delacruz@example.com',
      facebookProfile: 'facebook.com/juan.delacruz',
    },
    currentAddress: {
      houseNoStreet: '123 Purok 1',
      barangay: 'Bactas',
      municipalityCity: 'Basud',
      province: 'Camarines Norte',
      zipCode: '4608',
    },
    permanentAddress: {
      sameAsCurrent: true,
    },
    government: {
      philSysNationalIdNumber: '1234-5678-9012',
      sssNumber: '12-3456789-0',
      philHealthNumber: '123456789012',
      pagibigNumber: '1234-5678-9012',
      tinNumber: '123-456-789-000',
      passportNumber: 'P1234567A',
    },
    eligibility: {
      legallyEligible: 'Yes',
      validGovernmentId: 'Yes',
      willingToWork: ['Within Municipality', 'Overseas'],
    },
    pwd: {
      isPersonWithDisability: 'No',
      disabilityType: '',
    },
    specialCategories: {
      fourPsBeneficiary: true,
      indigenousPeople: false,
      soloParent: false,
      seniorCitizen: false,
      returningOfw: false,
    },
    emergency: {
      fullName: 'Maria Dela Cruz',
      relationship: 'Mother',
      contactNumber: '09181234567',
      address: 'Basud, Camarines Norte',
    },
    education: {
      highestEducationalAttainment: 'College Undergraduate',
      schoolName: 'Basud National High School',
      courseProgram: 'BS Information Technology',
      yearGraduated: '2015',
      honorsAwards: '',
    },
    employment: {
      employmentStatus: 'Unemployed',
      desiredPosition: 'Encoder',
      preferredIndustry: 'Government',
      expectedSalary: '15000',
      yearsOfExperience: '2',
    },
    skills: {
      technicalSkills: 'MS Office',
      softSkills: 'Communication',
      languageSpoken: 'Filipino, English',
      computerSkills: 'Basic',
      certificationsLicense: 'None',
    },
    documents: {
      resumeAttached: true,
      validIdAttached: true,
      certificateAttached: false,
      otherDocumentsAttached: false,
    },
    ...overrides,
  }
}

describe('members API', () => {
  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/members')

    expect(response.status).toBe(401)
  })

  it('creates, reads, updates, and deletes a member', async () => {
    await login()

    const createResponse = await authorized()
      .post('/api/members')
      .send(sampleMember())

    expect(createResponse.status).toBe(201)
    const created = createResponse.body.member
    expect(created.id).toBeTruthy()
    expect(created.personal.lastName).toBe('Dela Cruz')
    expect(created.eligibility.willingToWork).toEqual(['Within Municipality', 'Overseas'])
    expect(created.specialCategories.fourPsBeneficiary).toBe(true)
    expect(created.specialCategories.seniorCitizen).toBe(false)
    expect(created.documents.resumeAttached).toBe(true)
    expect(created.permanentAddress.sameAsCurrent).toBe(true)
    expect(created.permanentAddress.barangay).toBe('Bactas')

    const listResponse = await authorized().get('/api/members')
    expect(listResponse.status).toBe(200)
    expect(listResponse.body.some((member) => member.id === created.id)).toBe(true)

    const readResponse = await authorized().get(`/api/members/${created.id}`)
    expect(readResponse.status).toBe(200)
    expect(readResponse.body.personal.firstName).toBe('Juan')

    const updateResponse = await authorized()
      .put(`/api/members/${created.id}`)
      .send(sampleMember({ personal: { ...sampleMember().personal, lastName: 'Reyes', firstName: 'Maria' } }))

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.member.personal.lastName).toBe('Reyes')
    expect(updateResponse.body.member.personal.firstName).toBe('Maria')

    const deleteResponse = await authorized().delete(`/api/members/${created.id}`)
    expect(deleteResponse.status).toBe(200)

    const missingResponse = await authorized().get(`/api/members/${created.id}`)
    expect(missingResponse.status).toBe(404)
  })

  it('rejects an invalid member id format', async () => {
    await login()

    const response = await authorized().get('/api/members/not-a-number')

    expect(response.status).toBe(400)
  })

  it('returns 404 for a non-existent member', async () => {
    await login()

    const response = await authorized().get('/api/members/99999999')

    expect(response.status).toBe(404)
  })

  it('rejects a non-object body on create', async () => {
    await login()

    const response = await authorized().post('/api/members').send('just a string')

    expect(response.status).toBe(400)
  })

  it('returns 404 when updating a non-existent member', async () => {
    await login()

    const response = await authorized()
      .put('/api/members/99999999')
      .send(sampleMember())

    expect(response.status).toBe(404)
  })
})
