import { Eye, X } from 'lucide-react'
import { activeFields, firstMediaValue } from '../utils/schemaRuntime'
import { resolveMediaUrl } from '../api/crmApi'

function formatValue(value) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export default function RecordDetailDialog({ open, schema, record, onClose, onEdit }) {
  if (!open || !record) return null
  const data = record.data || {}
  const fields = activeFields(schema).filter((field) => field.showOnDetail !== false)
  const image = firstMediaValue(schema, data, 'IMAGE')

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="record-detail-dialog" role="dialog" aria-modal="true" aria-label="Record details">
        <header>
          <div>
            <span className="eyebrow">{schema?.title || schema?.module || 'Record'}</span>
            <h2>{data.name || data.title || data.productName || record.id}</h2>
            <p>Read-only view generated from field metadata.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19}/></button>
        </header>

        {image && <img className="record-detail-image" src={resolveMediaUrl(image)} alt="" />}

        <div className="record-detail-grid">
          {fields.map((field) => (
            <article key={field.key}>
              <span>{field.label || field.key}</span>
              <strong>{formatValue(data[field.key])}</strong>
              <small>{field.type}</small>
            </article>
          ))}
        </div>

        <footer>
          <button type="button" className="button button-secondary" onClick={onClose}>Close</button>
          {onEdit && <button type="button" className="button button-primary" onClick={() => onEdit(record)}><Eye size={17}/> Edit record</button>}
        </footer>
      </section>
    </div>
  )
}
