import { useEffect } from 'react'
import ApplicantDetails from './ApplicantDetails.jsx'
import ApplicantForm from './ApplicantForm.jsx'
import DocumentsSection from './DocumentsSection.jsx'

export default function ApplicantModal({
  open,
  mode,
  member,
  form,
  formError,
  submitNotice,
  loadingMembers,
  editingId,
  authToken,
  onClose,
  onEdit,
  onDelete,
  onFieldChange,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleEscapeKey(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const isViewMode = mode === 'view' && Boolean(member)
  const title = mode === 'create'
    ? 'New applicant'
    : isViewMode
      ? `${member.personal.lastName}, ${member.personal.firstName}`
      : `ID #${editingId}`

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="applicant-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'Add Applicant' : isViewMode ? 'Applicant Details' : 'Edit Applicant'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <p className="eyebrow">{mode === 'create' ? 'Add Applicant' : isViewMode ? 'Applicant Details' : 'Edit Applicant'}</p>
            <h2>{title}</h2>
          </div>
          <div className="modal-header-actions">
            {isViewMode ? (
              <>
                <button type="button" className="secondary-button" onClick={() => onEdit(member)}>Edit</button>
                <button type="button" className="danger-button" onClick={() => onDelete(member)}>Delete</button>
              </>
            ) : null}
            <button type="button" className="ghost-button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="modal-body">
          {formError ? <div className="submit-notice error-notice" role="alert">{formError}</div> : null}

          {isViewMode && member ? <ApplicantDetails member={member} authToken={authToken} /> : null}

          {!isViewMode ? (
            <ApplicantForm
              form={form}
              editingId={editingId}
              loadingMembers={loadingMembers}
              submitNotice={submitNotice}
              onFieldChange={onFieldChange}
              onSubmit={onSubmit}
              onCancel={onClose}
            >
              {mode === 'edit' && editingId ? (
                <DocumentsSection
                  memberId={editingId}
                  authToken={authToken}
                  physicalDocuments={form.documents ?? {}}
                />
              ) : null}
            </ApplicantForm>
          ) : null}
        </div>
      </section>
    </div>
  )
}
