export function FieldLabel({ text, required = false, optional = false, emphasized = false }) {
  return (
    <span className={emphasized ? 'highlight-label' : 'field-label-text'}>
      {text}
      {required ? <span className="required-marker" aria-hidden="true"> {' '}* </span> : null}
      {optional ? <span className="optional-marker"> (Optional)</span> : null}
    </span>
  )
}

export function Notice({ tone = 'success', children }) {
  const toneClass = tone === 'error' ? ' error-notice' : ''
  return (
    <div className={`submit-notice${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <strong className="detail-value">{value || '-'}</strong>
    </div>
  )
}

export function DetailSection({ title, items }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      <div className="detail-grid">
        {items.map(([label, value]) => <DetailItem key={label} label={label} value={value} />)}
      </div>
    </section>
  )
}
