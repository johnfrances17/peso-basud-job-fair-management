import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  defaultSummaryColumnVisibility,
  membersPerPage,
  summaryColumnOptions,
  summaryColumnVisibilityStorageKey,
} from '../lib/constants.js'
import {
  formatDisplayDate,
  formatSex,
  formatTableAddress,
  getCategorySummary,
  normalizeSearchValue,
} from '../lib/format.js'
import { sortMembers } from '../lib/sort.js'
import { exportMembersToExcel, getMemberSearchText } from '../lib/members.js'

function readSummaryColumnVisibility() {
  if (typeof window === 'undefined') {
    return defaultSummaryColumnVisibility
  }

  try {
    const storedValue = window.localStorage.getItem(summaryColumnVisibilityStorageKey)
    if (!storedValue) {
      return defaultSummaryColumnVisibility
    }

    const parsedValue = JSON.parse(storedValue)
    return {
      name: parsedValue.name ?? defaultSummaryColumnVisibility.name,
      age: parsedValue.age ?? defaultSummaryColumnVisibility.age,
      gender: parsedValue.gender ?? defaultSummaryColumnVisibility.gender,
      address: parsedValue.address ?? defaultSummaryColumnVisibility.address,
      contact: parsedValue.contact ?? defaultSummaryColumnVisibility.contact,
      category: parsedValue.category ?? defaultSummaryColumnVisibility.category,
      dateSigned: parsedValue.dateSigned ?? defaultSummaryColumnVisibility.dateSigned,
    }
  } catch {
    return defaultSummaryColumnVisibility
  }
}

// Compact page list with ellipsis gaps: 1 … 3 4 5 … 12
function getPageList(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages])
  for (let page = Math.max(1, currentPage - 2); page <= Math.min(totalPages, currentPage + 2); page += 1) {
    pages.add(page)
  }

  return [...pages].sort((pageA, pageB) => pageA - pageB)
}

// Relative widths for loading skeleton bars, keyed by column.
const skeletonColumnWidths = {
  name: '46%',
  age: '16%',
  gender: '20%',
  address: '42%',
  contact: '34%',
  category: '24%',
  dateSigned: '28%',
}

export default function DashboardView({ members, loadingMembers, formError, onAddApplicant, onOpenMember, onDeleteSelected }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState(() => readSummaryColumnVisibility())
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const columnsMenuRef = useRef(null)
  const exportMenuRef = useRef(null)
  const headerCheckboxRef = useRef(null)

  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery).trim()

    if (!normalizedQuery) {
      return members
    }

    return members.filter((member) => getMemberSearchText(member).includes(normalizedQuery))
  }, [members, searchQuery])

  const sortedMembers = useMemo(
    () => sortMembers(filteredMembers, sortKey, sortDirection),
    [filteredMembers, sortKey, sortDirection],
  )

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / membersPerPage))

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * membersPerPage
    return sortedMembers.slice(startIndex, startIndex + membersPerPage)
  }, [currentPage, sortedMembers])

  const visibleColumnCount = summaryColumnOptions.filter(([key]) => columnVisibility[key]).length

  const shownStart = sortedMembers.length === 0 ? 0 : (currentPage - 1) * membersPerPage + 1
  const shownEnd = Math.min(currentPage * membersPerPage, sortedMembers.length)

  const pageMemberIds = paginatedMembers.map((member) => member.id)
  const allPageSelected = pageMemberIds.length > 0 && pageMemberIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageMemberIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  // Mirror the "select all on page" checkbox state (checked vs indeterminate).
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = somePageSelected && !allPageSelected
    }
  }, [somePageSelected, allPageSelected])

  // Drop selections for records that no longer exist (deleted by anyone).
  useEffect(() => {
    setSelectedIds((current) => {
      const liveIds = new Set(members.map((member) => member.id))
      const hasStaleIds = [...current].some((id) => !liveIds.has(id))
      return hasStaleIds ? new Set([...current].filter((id) => liveIds.has(id))) : current
    })
  }, [members])

  useEffect(() => {
    window.localStorage.setItem(summaryColumnVisibilityStorageKey, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  useEffect(() => {
    function handleOutsideMenuClick(event) {
      const targetNode = event.target

      if (!(targetNode instanceof Node)) {
        return
      }

      if (columnsMenuRef.current && !columnsMenuRef.current.contains(targetNode)) {
        setColumnsMenuOpen(false)
      }

      if (exportMenuRef.current && !exportMenuRef.current.contains(targetNode)) {
        setExportMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideMenuClick)
    document.addEventListener('touchstart', handleOutsideMenuClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideMenuClick)
      document.removeEventListener('touchstart', handleOutsideMenuClick)
    }
  }, [])

  function handleSearchChange(event) {
    setSearchQuery(event.target.value)
    setCurrentPage(1)
  }

  // Clicking a column cycles: no sort -> ascending -> descending -> no sort.
  function handleSort(nextSortKey) {
    if (sortKey !== nextSortKey) {
      setSortKey(nextSortKey)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortKey(null)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  function getSortIndicator(columnKey) {
    if (sortKey !== columnKey) {
      return <span className="sort-indicator" aria-hidden="true">↕</span>
    }

    return (
      <span className="sort-indicator active" aria-hidden="true">
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  function getAriaSort(columnKey) {
    if (sortKey !== columnKey) {
      return 'none'
    }
    return sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  function toggleColumnsMenu() {
    setColumnsMenuOpen((current) => !current)
    setExportMenuOpen(false)
  }

  function toggleExportMenu() {
    setExportMenuOpen((current) => !current)
    setColumnsMenuOpen(false)
  }

  function toggleColumnVisibility(columnKey) {
    if (columnKey === 'name') {
      return
    }

    setColumnVisibility((current) => ({
      ...current,
      [columnKey]: !current[columnKey],
    }))
  }

  function toggleSelect(memberId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  function toggleSelectPage() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allPageSelected) {
        pageMemberIds.forEach((id) => next.delete(id))
      } else {
        pageMemberIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  async function handleExportExcel() {
    const timestamp = new Date().toISOString().slice(0, 10)
    await exportMembersToExcel(filteredMembers, `basud-members-${timestamp}.xlsx`)
    setExportMenuOpen(false)
  }

  return (
    <section className="dashboard-panel" aria-label="Applicant records">
      <div className="summary-board">
        <div className="summary-board-copy">
          <span className="table-toolbar-label">Records</span>
        </div>

        {formError ? <div className="submit-notice error-notice summary-notice" role="alert">{formError}</div> : null}

        <div className="stats-grid dashboard-stats summary-stats">
          <div className="stat-card"><span>Total</span><strong>{members.length}</strong></div>
          <div className="stat-card"><span>Showing</span><strong>{filteredMembers.length}</strong></div>
          <div className="stat-card"><span>Page</span><strong>{currentPage} / {totalPages}</strong></div>
        </div>
      </div>

      <div className="table-board">
        <div className="table-toolbar dashboard-toolbar">
          <div className="table-toolbar-copy">
            <span className="table-toolbar-label">Applicant list</span>
          </div>

          <div className="table-toolbar-actions">
            <label className="search-shell" aria-label="Search members">
              <span className="search-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9.5 9.5 L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                className="search-input"
                placeholder="Search members"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </label>

            <div className="toolbar-actions-group">
              {/* Always in the layout so toggling the selection never shifts "+ Add Applicant". */}
              <div
                className="selection-actions"
                style={selectedIds.size === 0 ? { visibility: 'hidden' } : undefined}
                aria-hidden={selectedIds.size === 0}
              >
                <span className="selection-count" role="status">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : ''}
                </span>
                <button
                  type="button"
                  className="danger-button toolbar-button"
                  onClick={() => onDeleteSelected([...selectedIds])}
                  disabled={selectedIds.size === 0}
                >
                  Delete
                </button>
              </div>

              <button type="button" className="primary-button toolbar-button" onClick={onAddApplicant}>
                + Add Applicant
              </button>

              <div className="columns-menu" ref={columnsMenuRef}>
                <button type="button" className="secondary-button toolbar-button" onClick={toggleColumnsMenu}>
                  Columns
                </button>
                {columnsMenuOpen ? (
                  <div className="menu-panel" role="menu" aria-label="Column visibility options">
                    {summaryColumnOptions.map(([key, label]) => (
                      <label key={key} className="menu-check-row">
                        <input
                          type="checkbox"
                          checked={columnVisibility[key]}
                          disabled={key === 'name'}
                          onChange={() => toggleColumnVisibility(key)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="export-menu" ref={exportMenuRef}>
                <button type="button" className="secondary-button toolbar-button" onClick={toggleExportMenu}>
                  Export
                </button>
                {exportMenuOpen ? (
                  <div className="menu-panel" role="menu" aria-label="Export options">
                    <button type="button" className="export-menu-item" onClick={handleExportExcel} role="menuitem">
                      Excel (.xlsx)
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check-col" aria-label="Select all records on this page">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                  />
                </th>
                {columnVisibility.name ? (
                  <th aria-sort={getAriaSort('name')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('name')}>
                      <span>Name</span>
                      {getSortIndicator('name')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.age ? (
                  <th aria-sort={getAriaSort('age')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('age')}>
                      <span>Age</span>
                      {getSortIndicator('age')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.gender ? (
                  <th aria-sort={getAriaSort('gender')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('gender')}>
                      <span>Gender</span>
                      {getSortIndicator('gender')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.address ? (
                  <th aria-sort={getAriaSort('address')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('address')}>
                      <span>Address</span>
                      {getSortIndicator('address')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.contact ? (
                  <th aria-sort={getAriaSort('contact')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('contact')}>
                      <span>Contact</span>
                      {getSortIndicator('contact')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.category ? (
                  <th aria-sort={getAriaSort('category')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('category')}>
                      <span>Category</span>
                      {getSortIndicator('category')}
                    </button>
                  </th>
                ) : null}
                {columnVisibility.dateSigned ? (
                  <th aria-sort={getAriaSort('dateSigned')}>
                    <button type="button" className="sort-button" onClick={() => handleSort('dateSigned')}>
                      <span>Date Signed</span>
                      {getSortIndicator('dateSigned')}
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loadingMembers ? (
                <>
                  {[0, 1, 2].map((rowIndex) => (
                    <tr key={rowIndex} className="skeleton-row" aria-hidden="true">
                      <td className="check-col"><span className="skeleton-box skeleton-check" /></td>
                      {summaryColumnOptions
                        .filter(([key]) => columnVisibility[key])
                        .map(([key]) => (
                          <td key={key}><span className="skeleton-box" style={{ width: skeletonColumnWidths[key] }} /></td>
                        ))}
                    </tr>
                  ))}
                  <tr className="table-status-row">
                    <td colSpan={visibleColumnCount + 1}>
                      <div className="table-loading-state" role="status" aria-live="polite">
                        <span className="spinner" aria-hidden="true" />
                        <span>Loading records…</span>
                      </div>
                    </td>
                  </tr>
                </>
              ) : paginatedMembers.length > 0 ? (
                paginatedMembers.map((member) => (
                  <tr key={member.id} className="member-row" onClick={() => onOpenMember(member)} role="button" tabIndex={0} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpenMember(member)
                    }
                  }}>
                    <td className="check-col" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.personal.lastName}, ${member.personal.firstName}`}
                        checked={selectedIds.has(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </td>
                    {columnVisibility.name ? <td><div className="cell-stack"><strong>{member.personal.lastName}, {member.personal.firstName}</strong><span className="muted-line">{member.personal.civilStatus || 'Not specified'}</span></div></td> : null}
                    {columnVisibility.age ? <td>{member.personal.age || '-'}</td> : null}
                    {columnVisibility.gender ? <td>{formatSex(member.personal.sex)}</td> : null}
                    {columnVisibility.address ? <td>{formatTableAddress(member.currentAddress)}</td> : null}
                    {columnVisibility.contact ? <td>{member.contact.mobileNumber || member.contact.emailAddress || '-'}</td> : null}
                    {columnVisibility.category ? <td><span className="status-pill">{getCategorySummary(member)}</span></td> : null}
                    {columnVisibility.dateSigned ? <td>{formatDisplayDate(member.createdAt)}</td> : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumnCount + 1}><div className="empty-state">{searchQuery ? 'No matching records found.' : 'No records yet.'}</div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <span className="pagination-summary">
            {loadingMembers
              ? 'Loading records…'
              : sortedMembers.length > 0
                ? `Showing ${shownStart}–${shownEnd} of ${sortedMembers.length}`
                : 'No records to show'}
          </span>

          <div className="page-numbers">
            {getPageList(currentPage, totalPages).map((page, index, pageList) => (
              <Fragment key={page}>
                {index > 0 && page - pageList[index - 1] > 1 ? <span className="page-ellipsis" aria-hidden="true">…</span> : null}
                <button type="button" className={page === currentPage ? 'page-button active' : 'page-button'} onClick={() => setCurrentPage(page)}>
                  {page}
                </button>
              </Fragment>
            ))}
          </div>

          <div className="pagination-nav">
            <button type="button" className="secondary-button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
            <button type="button" className="secondary-button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
          </div>
        </div>
      </div>
    </section>
  )
}
