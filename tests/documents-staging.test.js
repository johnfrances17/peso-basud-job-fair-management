import { describe, expect, it } from 'vitest'
import { getDocumentStatusCounts } from '../src/lib/documents.js'

const attachments = [
  { id: 1, documentType: 'resume', fileName: 'a.pdf' },
  { id: 2, documentType: 'resume', fileName: 'b.pdf' },
  { id: 3, documentType: 'valid_id', fileName: 'c.png' },
]

describe('getDocumentStatusCounts', () => {
  it('counts kept, staged and total copies for a type', () => {
    const counts = getDocumentStatusCounts({
      attachments,
      pendingUploads: [{ type: 'resume', file: {} }],
      pendingRemovals: [],
      type: 'resume',
    })

    expect(counts).toEqual({ keptCount: 2, removedCount: 0, stagedCount: 1, totalCount: 3 })
  })

  it('excludes staged-removal attachments from kept and total', () => {
    const counts = getDocumentStatusCounts({
      attachments,
      pendingUploads: [],
      pendingRemovals: [2],
      type: 'resume',
    })

    expect(counts).toEqual({ keptCount: 1, removedCount: 1, stagedCount: 0, totalCount: 1 })
  })

  it('combines staged uploads with kept attachments', () => {
    const counts = getDocumentStatusCounts({
      attachments,
      pendingUploads: [{ type: 'valid_id', file: {} }],
      pendingRemovals: [3],
      type: 'valid_id',
    })

    expect(counts).toEqual({ keptCount: 0, removedCount: 1, stagedCount: 1, totalCount: 1 })
  })

  it('returns zeros for a type with no activity', () => {
    const counts = getDocumentStatusCounts({
      attachments,
      pendingUploads: [],
      pendingRemovals: [],
      type: 'certificate',
    })

    expect(counts).toEqual({ keptCount: 0, removedCount: 0, stagedCount: 0, totalCount: 0 })
  })
})
