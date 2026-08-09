import { useEffect, useState } from 'react'
import { requestJson, uploadFile, downloadFile } from '../lib/api.js'
import { formatDisplayDate } from '../lib/format.js'
import { Notice } from './ui.jsx'

const documentTypeDefinitions = [
  {
    type: 'resume',
    label: 'Resume',
    physicalField: 'resumeAttached',
    acceptHint: 'PDF, DOC, JPG, PNG, TXT',
    accept: 'application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
  },
  {
    type: 'valid_id',
    label: 'Valid ID',
    physicalField: 'validIdAttached',
    acceptHint: 'JPG, PNG, WEBP, PDF',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    type: 'certificate',
    label: 'Certificate/s',
    physicalField: 'certificateAttached',
    acceptHint: 'PDF, JPG, PNG, WEBP',
    accept: 'application/pdf,image/jpeg,image/png,image/webp',
  },
  {
    type: 'other',
    label: 'Other Documents',
    physicalField: 'otherDocumentsAttached',
    acceptHint: 'PDF, DOC, XLS, JPG, PNG, TXT',
    accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,text/plain',
  },
]

const FILE_BADGES = {
  pdf: ['PDF', 'pdf'],
  doc: ['DOC', 'doc'],
  docx: ['DOC', 'doc'],
  xls: ['XLS', 'xls'],
  xlsx: ['XLS', 'xls'],
  jpg: ['IMG', 'img'],
  jpeg: ['IMG', 'img'],
  png: ['IMG', 'img'],
  webp: ['IMG', 'img'],
  gif: ['IMG', 'img'],
  txt: ['TXT', 'txt'],
}

function fileBadge(fileName) {
  const extension = String(fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
  return FILE_BADGES[extension] ?? ['FILE', 'other']
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) {
    return ''
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  )
}

export default function DocumentsSection({ memberId, authToken, physicalDocuments = {} }) {
  const [attachments, setAttachments] = useState(() => [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingType, setUploadingType] = useState(null)

  useEffect(() => {
    let isActive = true

    async function loadAttachments() {
      setLoading(true)
      setError('')
      try {
        const list = await requestJson(`/api/members/${memberId}/documents`, {}, authToken)
        if (isActive) {
          setAttachments(list)
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError.message)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadAttachments()
    return () => {
      isActive = false
    }
  }, [memberId, authToken])

  async function handleUpload(type, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingType) {
      return
    }

    setUploadingType(type)
    setError('')
    try {
      const payload = await uploadFile(`/api/members/${memberId}/documents`, file, authToken, { documentType: type })
      setAttachments((current) => [payload.attachment, ...current])
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploadingType(null)
    }
  }

  async function handleDownload(attachment) {
    setError('')
    try {
      await downloadFile(`/api/members/${memberId}/documents/${attachment.id}/download`, attachment.fileName, authToken)
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  async function handleDelete(attachment) {
    if (!window.confirm(`Delete ${attachment.fileName}? This cannot be undone.`)) {
      return
    }

    setError('')
    try {
      await requestJson(`/api/members/${memberId}/documents/${attachment.id}`, { method: 'DELETE' }, authToken)
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <section className="detail-section">
      <div className="detail-section-header">
        <h4>Documents</h4>
        <p className="attachment-note">Optional — applicants may pass documents physically, digitally, or both.</p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? <p className="attachment-note">Loading attachments…</p> : null}

      <div className="attachment-list">
        {documentTypeDefinitions.map((definition) => {
          const typeAttachments = attachments.filter((attachment) => attachment.documentType === definition.type)
          const passedPhysically = Boolean(physicalDocuments[definition.physicalField])
          const isUploading = uploadingType === definition.type

          return (
            <div className="attachment-group" key={definition.type}>
              <div className="attachment-group-header">
                <div className="attachment-group-title">
                  <strong>{definition.label}</strong>
                  {typeAttachments.length > 0 ? (
                    <span className="attachment-count">
                      {typeAttachments.length} digital {typeAttachments.length === 1 ? 'copy' : 'copies'}
                    </span>
                  ) : null}
                </div>
                <span className={`physical-badge ${passedPhysically ? 'physical-badge-yes' : ''}`}>
                  <span className="physical-badge-dot" aria-hidden="true" />
                  {passedPhysically ? 'Physical copy received' : 'No physical copy'}
                </span>
              </div>

              {typeAttachments.length > 0 ? (
                <ul className="attachment-file-list">
                  {typeAttachments.map((attachment) => {
                    const [badgeLabel, badgeKind] = fileBadge(attachment.fileName)
                    return (
                      <li className="attachment-file" key={attachment.id}>
                        <span className={`attachment-file-badge attachment-file-badge-${badgeKind}`} aria-hidden="true">
                          {badgeLabel}
                        </span>
                        <span className="attachment-file-main">
                          <span className="attachment-file-name" title={attachment.fileName}>{attachment.fileName}</span>
                          <span className="attachment-file-meta">
                            {formatFileSize(attachment.fileSize)}
                            {attachment.createdAt ? ` · ${formatDisplayDate(attachment.createdAt)}` : ''}
                          </span>
                        </span>
                        <span className="attachment-file-actions">
                          <button type="button" className="ghost-button attachment-action" onClick={() => handleDownload(attachment)}>
                            Download
                          </button>
                          <button type="button" className="danger-button attachment-action" onClick={() => handleDelete(attachment)}>
                            Delete
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              <label className={`file-upload-zone ${isUploading ? 'file-upload-zone-busy' : ''}`}>
                <span className="file-upload-icon"><UploadIcon /></span>
                <span className="file-upload-copy">
                  <strong>{isUploading ? 'Uploading…' : `Upload ${definition.label}`}</strong>
                  <small>{definition.acceptHint} · Max 10 MB per file</small>
                </span>
                <input
                  type="file"
                  accept={definition.accept}
                  disabled={Boolean(uploadingType)}
                  onChange={(event) => handleUpload(definition.type, event)}
                />
              </label>
            </div>
          )
        })}
      </div>
    </section>
  )
}
