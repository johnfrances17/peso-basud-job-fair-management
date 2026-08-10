import { useEffect, useRef, useState } from 'react'
import './App.css'
import ApplicantModal from './components/ApplicantModal.jsx'
import DashboardView from './components/DashboardView.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { requestJson, uploadFile } from './lib/api.js'
import { authStorageKey } from './lib/constants.js'
import { calculateAge } from './lib/format.js'
import {
  buildMember,
  createEmptyForm,
  hydrateFormFromMember,
  normalizeSectionFieldValue,
} from './lib/members.js'

function createEmptyLoginForm() {
  return {
    email: '',
    password: '',
  }
}

function App() {
  const [authToken, setAuthToken] = useState('')
  const [staffAccount, setStaffAccount] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginForm, setLoginForm] = useState(() => createEmptyLoginForm())
  const [loginError, setLoginError] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [members, setMembers] = useState(() => [])
  const [form, setForm] = useState(() => createEmptyForm())
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [modalMode, setModalMode] = useState('create')
  const [activeMember, setActiveMember] = useState(null)
  const pendingDocumentsRef = useRef({ uploads: [], removals: [] })

  useEffect(() => {
    setForm((current) => {
      const nextAge = calculateAge(current.personal.dateOfBirth)

      if (current.personal.age === nextAge) {
        return current
      }

      return {
        ...current,
        personal: {
          ...current.personal,
          age: nextAge,
        },
      }
    })
  }, [form.personal.dateOfBirth])

  useEffect(() => {
    let isActive = true

    async function loadSession() {
      const storedToken = window.localStorage.getItem(authStorageKey)

      if (!storedToken) {
        if (isActive) {
          setAuthLoading(false)
        }
        return
      }

      try {
        const response = await requestJson('/api/auth/me', {}, storedToken)
        if (isActive) {
          setAuthToken(storedToken)
          setStaffAccount(response.staff)
        }
      } catch {
        window.localStorage.removeItem(authStorageKey)
      } finally {
        if (isActive) {
          setAuthLoading(false)
        }
      }
    }

    loadSession()
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!authToken) {
      setMembers([])
      return undefined
    }

    let isActive = true

    async function loadMembers() {
      setLoadingMembers(true)
      try {
        const loadedMembers = await requestJson('/api/members', {}, authToken)
        if (isActive) {
          setMembers(loadedMembers)
          setFormError('')
        }
      } catch (error) {
        if (isActive) {
          if (error.message === 'Unauthorized') {
            handleLogout()
            return
          }
          setFormError(error.message)
        }
      } finally {
        if (isActive) {
          setLoadingMembers(false)
        }
      }
    }

    loadMembers()
    return () => {
      isActive = false
    }
  }, [authToken])

  async function handleLogin(event) {
    event.preventDefault()
    setLoginSubmitting(true)
    setLoginError('')

    try {
      const response = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })

      window.localStorage.setItem(authStorageKey, response.token)
      setAuthToken(response.token)
      setStaffAccount(response.staff)
      setLoginForm(createEmptyLoginForm())
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginSubmitting(false)
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(authStorageKey)
    setAuthToken('')
    setStaffAccount(null)
    setMembers([])
    setForm(createEmptyForm())
    setEditingId(null)
    setModalOpen(false)
    setSubmitNotice('')
    setFormError('')
    setLoginError('')
  }

  async function handleDeleteMember(member) {
    if (!member) {
      return
    }

    const memberName = `${member.personal?.lastName || 'Applicant'}, ${member.personal?.firstName || ''}`.trim()
    const confirmed = window.confirm(`Delete ${memberName}? This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    try {
      await requestJson(`/api/members/${member.id}`, { method: 'DELETE' }, authToken)
      setMembers((currentMembers) => currentMembers.filter((currentMember) => currentMember.id !== member.id))
      setModalOpen(false)
      setEditingId(null)
      setActiveMember(null)
      setModalMode('create')
      setSubmitNotice('Applicant record deleted successfully.')
    } catch (error) {
      if (error.message === 'Unauthorized') {
        handleLogout()
        return
      }
      setFormError(error.message)
    }
  }

  async function handleDeleteSelected(memberIds) {
    const ids = [...new Set(memberIds)]
    if (ids.length === 0) {
      return
    }

    const label = ids.length === 1
      ? 'Delete 1 selected applicant record?'
      : `Delete ${ids.length} selected applicant records?`
    const confirmed = window.confirm(`${label} This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    try {
      await Promise.all(ids.map((id) => requestJson(`/api/members/${id}`, { method: 'DELETE' }, authToken)))
      setMembers((currentMembers) => currentMembers.filter((member) => !ids.includes(member.id)))
      setSubmitNotice(ids.length === 1
        ? 'Applicant record deleted successfully.'
        : `${ids.length} applicant records deleted successfully.`)
    } catch (error) {
      if (error.message === 'Unauthorized') {
        handleLogout()
        return
      }
      setFormError(error.message)
    }
  }

  function openCreateModal() {
    pendingDocumentsRef.current = { uploads: [], removals: [] }
    setModalMode('create')
    setActiveMember(null)
    setEditingId(null)
    setForm(createEmptyForm())
    setSubmitNotice('')
    setFormError('')
    setModalOpen(true)
  }

  function openMemberDetails(member) {
    pendingDocumentsRef.current = { uploads: [], removals: [] }
    setModalMode('view')
    setActiveMember(member)
    setEditingId(member.id)
    setForm(hydrateFormFromMember(member))
    setSubmitNotice('')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(member = activeMember) {
    if (!member) {
      return
    }

    pendingDocumentsRef.current = { uploads: [], removals: [] }
    setModalMode('edit')
    setActiveMember(member)
    setEditingId(member.id)
    setForm(hydrateFormFromMember(member))
    setSubmitNotice('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    pendingDocumentsRef.current = { uploads: [], removals: [] }
    setModalOpen(false)
    setEditingId(null)
    setActiveMember(null)
    setModalMode('create')
  }

  function setSectionField(section, field, value) {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: normalizeSectionFieldValue(section, field, value),
      },
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setSubmitting(true)
    setSubmitNotice('')
    setFormError('')

    try {
      const payload = buildMember(form, editingId ?? `member-${Date.now()}`)
      const endpoint = editingId ? `/api/members/${editingId}` : '/api/members'
      const method = editingId ? 'PUT' : 'POST'
      const response = await requestJson(endpoint, {
        method,
        body: JSON.stringify(payload),
      }, authToken)

      const nextMember = response.member
      setMembers((currentMembers) => {
        if (editingId) {
          return currentMembers.map((member) => (member.id === nextMember.id ? nextMember : member))
        }
        return [nextMember, ...currentMembers]
      })

      let uploadNote = ''
      const pendingPlan = pendingDocumentsRef.current
      pendingDocumentsRef.current = { uploads: [], removals: [] }

      if (pendingPlan.uploads.length > 0) {
        let uploadedCount = 0
        const failures = []
        for (const item of pendingPlan.uploads) {
          try {
            await uploadFile(`/api/members/${nextMember.id}/documents`, item.file, authToken, { documentType: item.type })
            uploadedCount += 1
          } catch (uploadError) {
            failures.push(uploadError.message)
          }
        }
        if (uploadedCount > 0) {
          uploadNote += ` ${uploadedCount} digital document${uploadedCount === 1 ? '' : 's'} attached.`
        }
        if (failures.length > 0) {
          uploadNote += ` ${failures.length} upload${failures.length === 1 ? '' : 's'} failed: ${failures.join('; ')}`
        }
      }

      if (pendingPlan.removals.length > 0) {
        let removedCount = 0
        const failures = []
        for (const attachmentId of pendingPlan.removals) {
          try {
            await requestJson(`/api/members/${nextMember.id}/documents/${attachmentId}`, { method: 'DELETE' }, authToken)
            removedCount += 1
          } catch (removeError) {
            failures.push(removeError.message)
          }
        }
        if (removedCount > 0) {
          uploadNote += ` ${removedCount} digital document${removedCount === 1 ? '' : 's'} removed.`
        }
        if (failures.length > 0) {
          uploadNote += ` ${failures.length} removal${failures.length === 1 ? '' : 's'} failed: ${failures.join('; ')}`
        }
      }

      setEditingId(null)
      setForm(createEmptyForm())
      setModalOpen(false)
      setSubmitNotice((response.message || (editingId ? 'Member record updated successfully.' : 'Member record inserted successfully.')) + uploadNote)
    } catch (error) {
      if (error.message === 'Unauthorized') {
        handleLogout()
        return
      }
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleLoginFieldChange(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }))
  }

  function handlePendingDocumentsChange(plan) {
    pendingDocumentsRef.current = {
      uploads: plan?.uploads ?? [],
      removals: plan?.removals ?? [],
    }
  }

  let screen = null

  if (authLoading) {
    screen = (
      <div className="auth-shell auth-shell-loading">
        <div className="auth-loading-card panel">
          <h1>Loading</h1>
        </div>
      </div>
    )
  } else if (authToken) {
    screen = (
      <div className="app-shell app-shell-dashboard">
        <header className="dashboard-bar" aria-label="Applicants header">
          <div className="dashboard-bar-left">
            <div className="dashboard-bar-brand">
              <img className="dashboard-bar-brand-mark" src="/logo.svg" alt="" aria-hidden="true" />
              <div>
                <p className="dashboard-bar-eyebrow">PESO Basud</p>
                <h1>Applicants</h1>
              </div>
            </div>
          </div>

          <div className="dashboard-bar-right">
            <div className="dashboard-bar-status">
              <span>Signed in as</span>
              <strong>{staffAccount?.displayName ?? staffAccount?.email ?? 'Staff'}</strong>
            </div>
            <button type="button" className="dashboard-bar-button" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="page-shell">
          <DashboardView
            members={members}
            loadingMembers={loadingMembers}
            formError={formError}
            onAddApplicant={openCreateModal}
            onOpenMember={openMemberDetails}
            onDeleteSelected={handleDeleteSelected}
          />
        </main>

        <footer className="app-footer">
          Public Employment Service Office · Municipality of Basud, Camarines Norte
        </footer>
      </div>
    )
  } else {
    screen = (
      <LoginScreen
        form={loginForm}
        error={loginError}
        submitting={loginSubmitting}
        onChange={handleLoginFieldChange}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <>
      {screen}

      <ApplicantModal
        open={modalOpen}
        mode={modalMode}
        member={activeMember}
        form={form}
        formError={formError}
        submitNotice={submitNotice}
        loadingMembers={loadingMembers}
        submitting={submitting}
        editingId={editingId}
        authToken={authToken}
        onClose={closeModal}
        onEdit={openEditModal}
        onDelete={handleDeleteMember}
        onFieldChange={setSectionField}
        onSubmit={handleSubmit}
        onPendingDocumentsChange={handlePendingDocumentsChange}
      />
    </>
  )
}

export default App
