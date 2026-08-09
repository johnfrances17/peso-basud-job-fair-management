import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../server/app.js'

// In-memory fake for Supabase Storage so the suite runs without credentials.
const { storageMap } = vi.hoisted(() => ({ storageMap: new Map() }))

vi.mock('../server/storage.js', () => ({
  uploadAttachment: vi.fn(async ({ storagePath, buffer }) => {
    storageMap.set(storagePath, Buffer.from(buffer))
    return { storagePath }
  }),
  downloadAttachment: vi.fn(async (storagePath) => {
    const buffer = storageMap.get(storagePath)
    if (!buffer) {
      throw new Error('Object not found')
    }
    return buffer
  }),
  deleteAttachment: vi.fn(async (storagePath) => {
    storageMap.delete(storagePath)
  }),
}))

let authToken = ''

async function login() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'staff@basud.local', password: 'Basud1234' })
  authToken = response.body.token
  return authToken
}

let memberCounter = 0

function sampleMember() {
  memberCounter += 1
  const suffix = String(memberCounter)
  return {
    personal: {
      lastName: `Torres${suffix}`,
      firstName: 'Ramon',
      middleName: 'B',
      suffix: '',
      sex: 'M',
      dateOfBirth: '1990-01-15',
      placeOfBirth: 'Basud, Camarines Norte',
      age: 36,
      civilStatus: 'Single',
      nationality: 'Filipino',
      religion: 'Roman Catholic',
    },
    contact: {
      mobileNumber: `0917${String(7000000 + memberCounter)}`,
      emailAddress: `ramon.torres${suffix}@example.com`,
      facebookProfile: '',
    },
    currentAddress: {
      houseNoStreet: '1 Purok 1',
      barangay: 'Bactas',
      municipalityCity: 'Basud',
      province: 'Camarines Norte',
      zipCode: '4608',
    },
    permanentAddress: { sameAsCurrent: true },
    government: {},
    eligibility: {
      legallyEligible: 'Yes',
      validGovernmentId: 'Yes',
      willingToWork: ['Within Municipality'],
    },
    pwd: { isPersonWithDisability: 'No', disabilityType: '' },
    specialCategories: {
      fourPsBeneficiary: false,
      indigenousPeople: false,
      soloParent: false,
      seniorCitizen: false,
      returningOfw: false,
    },
    employment: {
      employmentStatus: 'Unemployed',
      desiredPosition: 'Encoder',
      preferredIndustry: 'Government',
      expectedSalary: '15000',
      yearsOfExperience: '2',
    },
  }
}

async function createMember() {
  const response = await request(app)
    .post('/api/members')
    .set('Authorization', `Bearer ${authToken}`)
    .send(sampleMember())

  if (response.status !== 201) {
    throw new Error(`Failed to create member: ${response.status} ${JSON.stringify(response.body)}`)
  }

  return response.body.member.id
}

const pdfBuffer = Buffer.from('%PDF-1.4 fake resume content')
const pngBuffer = Buffer.from('fake png bytes')

beforeEach(async () => {
  storageMap.clear()
  authToken = ''
})

describe('document attachments', () => {
  it('requires staff auth for list, upload, download, and delete', async () => {
    expect((await request(app).get('/api/members/1/documents')).status).toBe(401)
    expect((await request(app).post('/api/members/1/documents')).status).toBe(401)
    expect((await request(app).get('/api/members/1/documents/1/download')).status).toBe(401)
    expect((await request(app).delete('/api/members/1/documents/1')).status).toBe(401)
  })

  it('uploads a PDF, lists it, and streams it back on download', async () => {
    await login()
    const memberId = await createMember()

    const uploadResponse = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'resume')
      .attach('file', pdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })

    expect(uploadResponse.status).toBe(201)
    expect(uploadResponse.body.attachment).toMatchObject({
      documentType: 'resume',
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      fileSize: String(pdfBuffer.length),
      uploadedBy: 'staff@basud.local',
    })
    expect(storageMap.size).toBe(1)

    const attachmentId = uploadResponse.body.attachment.id
    const listResponse = await request(app)
      .get(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(listResponse.status).toBe(200)
    expect(listResponse.body).toHaveLength(1)
    expect(listResponse.body[0].fileName).toBe('resume.pdf')

    const downloadResponse = await request(app)
      .get(`/api/members/${memberId}/documents/${attachmentId}/download`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers['content-type']).toBe('application/pdf')
    expect(downloadResponse.headers['content-disposition']).toContain('resume.pdf')
    expect(downloadResponse.body.equals(pdfBuffer)).toBe(true)
  })

  it('rejects a file type that is not on the whitelist', async () => {
    await login()
    const memberId = await createMember()

    const response = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'resume')
      .attach('file', Buffer.from('MZ executable'), { filename: 'malware.exe', contentType: 'application/x-msdownload' })

    expect(response.status).toBe(400)
    expect(storageMap.size).toBe(0)
  })

  it('rejects a missing file and an invalid document type', async () => {
    await login()
    const memberId = await createMember()

    const missingFile = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'resume')
    expect(missingFile.status).toBe(400)

    const badType = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'bank_statement')
      .attach('file', pdfBuffer, { filename: 'x.pdf', contentType: 'application/pdf' })
    expect(badType.status).toBe(400)
  })

  it('rejects a file larger than 10 MB', async () => {
    await login()
    const memberId = await createMember()
    const oversized = Buffer.alloc(11 * 1024 * 1024)

    const response = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'other')
      .attach('file', oversized, { filename: 'big.pdf', contentType: 'application/pdf' })

    expect(response.status).toBe(413)
    expect(storageMap.size).toBe(0)
  })

  it('rejects uploads and downloads for a nonexistent member or attachment', async () => {
    await login()

    const uploadMissing = await request(app)
      .post('/api/members/999999/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'resume')
      .attach('file', pdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
    expect(uploadMissing.status).toBe(404)

    const downloadMissing = await request(app)
      .get('/api/members/999999/documents/1/download')
      .set('Authorization', `Bearer ${authToken}`)
    expect(downloadMissing.status).toBe(404)
  })

  it('deletes an attachment (file removed from storage too)', async () => {
    await login()
    const memberId = await createMember()

    const uploadResponse = await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'valid_id')
      .attach('file', pngBuffer, { filename: 'id.png', contentType: 'image/png' })
    const attachmentId = uploadResponse.body.attachment.id

    const deleteResponse = await request(app)
      .delete(`/api/members/${memberId}/documents/${attachmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(deleteResponse.status).toBe(200)

    const listResponse = await request(app)
      .get(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(listResponse.body).toHaveLength(0)
    expect(storageMap.size).toBe(0)
  })

  it('removes stored files when a member is deleted', async () => {
    await login()
    const memberId = await createMember()

    await request(app)
      .post(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('documentType', 'certificate')
      .attach('file', pdfBuffer, { filename: 'cert.pdf', contentType: 'application/pdf' })
    expect(storageMap.size).toBe(1)

    const deleteMember = await request(app)
      .delete(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(deleteMember.status).toBe(200)
    expect(storageMap.size).toBe(0)

    const listResponse = await request(app)
      .get(`/api/members/${memberId}/documents`)
      .set('Authorization', `Bearer ${authToken}`)
    expect(listResponse.status).toBe(404)
  })
})
