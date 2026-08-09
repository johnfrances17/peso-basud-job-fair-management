import { useEffect, useState } from 'react'
import { requestJson, uploadFile, downloadFile } from '../lib/api.js'
import { Notice } from './ui.jsx'

const documentTypeDefinitions = [
  {
    type: 'resume',
    label: 'Resume',
    physicalField: 'resumeAttached',
    accept: 'application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
  },
  {
    type: 'valid_id',
    label: 'Valid ID',
    physicalField: 'validIdAttached',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    type: 'certificate',
    label: 'Certificate/s',
    physicalField: 'certificateAttached',
    accept: 'application/pdf,image/jpeg,image/png,image/webp',
  },
  {
    type: 'other',
    label: 'Other Documents',
    physicalField: 'otherDocumentsAttached',
    accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,text/plain',
  },
]

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
        <p className="fieldset-note">Optional — applicants may pass documents physically, digitally, or both.</p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? <p className="fieldset-note">Loading attachments…</p> : null}

      <div className="attachment-list">
        {documentTypeDefinitions.map((definition) => {
          const typeAttachments = attachments.filter((attachment) => attachment.documentType === definition.type)
          const passedPhysically = Boolean(physicalDocuments[definition.physicalField])
          const isUploading = uploadingType === definition.type

          return (
            <div className="attachment-group" key={definition.type}>
              <div className="attachment-group-header">
                <strong>{definition.label}</strong>
                <span className={`physical-badge ${passedPhysically ? 'physical-badge-yes' : ''}`}>
                  Physical: {passedPhysically ? 'Yes' : 'No'}
                </span>
              </div>

              {typeAttachments.length > 0 ? (
                <ul className="attachment-chip-list">
                  {typeAttachments.map((attachment) => (
                    <li className="attachment-chip" key={attachment.id}>
                      <span className="attachment-chip-name" title={attachment.fileName}>
                        {attachment.fileName}
                      </span>
                      <span className="attachment-chip-meta">{formatFileSize(attachment.fileSize)}</span>
                      <button
                        type="button"
                        className="ghost-button attachment-chip-button"
                        onClick={() => handleDownload(attachment)}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        className="danger-button attachment-chip-button"
                        onClick={() => handleDelete(attachment)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fieldset-note attachment-empty">No digital file uploaded.</p>
              )}

              <label className={`file-upload-button ${isUploading ? 'file-upload-button-busy' : ''}`}>
                <span>{isUploading ? 'Uploading…' : 'Upload digital copy'}</span>
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
